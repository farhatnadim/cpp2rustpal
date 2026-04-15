import * as vscode from 'vscode';
import * as path from 'path';
import { LlmClient } from './llm-client';
import { CargoMirror, resolveTargetForFile } from './cargo-mirror';

const CPP_LANGUAGES = ['cpp', 'c', 'cuda-cpp'];

type StatusState = 'online' | 'thinking' | 'offline' | 'disabled';

interface HintSection {
  line: number; // 1-based
  heading: string;
  body: string; // the full markdown section (heading + body lines)
}

interface HintsCache {
  sections: HintSection[];
  byLine: Map<number, HintSection>;
}

export class FeatureDetector {
  private disposables: vscode.Disposable[] = [];
  private sideBySide: boolean = true;
  private llmEnabled: boolean = true;
  private llmEndpoint: string = 'http://localhost:8001';
  private llmModel: string = 'unsloth/Qwen3.5-35B-A3B';
  private healthCheckIntervalMs: number = 30000;

  private llmClient: LlmClient = new LlmClient(this.llmEndpoint, this.llmModel);
  private cargoMirror: CargoMirror = new CargoMirror();

  private statusBar: vscode.StatusBarItem;
  private healthTimer: NodeJS.Timeout | null = null;
  private currentStatus: StatusState = 'offline';

  private openedHintsFiles: Set<string> = new Set();
  private hintsByCppUri: Map<string, HintsCache> = new Map();

  constructor(_context: vscode.ExtensionContext) {
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.command = 'cppToRust.retryHealth';
    this.loadSettings();
  }

  private loadSettings(): void {
    const cfg = vscode.workspace.getConfiguration('cppToRust');
    this.sideBySide = cfg.get('sideBySide', true);
    this.llmEnabled = cfg.get('llmEnabled', true);
    this.llmEndpoint = cfg.get('llmEndpoint', 'http://localhost:8001');
    this.llmModel = cfg.get('llmModel', 'unsloth/Qwen3.5-35B-A3B');
    this.healthCheckIntervalMs = cfg.get('healthCheckIntervalMs', 30000);
    this.llmClient.updateConfig(this.llmEndpoint, this.llmModel);
  }

  public activate(): void {
    this.loadSettings();

    const saveDisp = vscode.workspace.onDidSaveTextDocument((doc) => {
      if (this.isCppFile(doc)) void this.processDocument(doc);
    });

    const activeDisp = vscode.window.onDidChangeActiveTextEditor(() => {
      this.updateHealthTimer();
      this.renderStatus();
    });

    const configDisp = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cppToRust')) {
        this.loadSettings();
        this.updateHealthTimer();
        this.renderStatus();
      }
    });

    const closeDisp = vscode.workspace.onDidCloseTextDocument((doc) => {
      const uriStr = doc.uri.toString();
      if (this.isCppFile(doc) && this.openedHintsFiles.has(uriStr)) {
        this.openedHintsFiles.delete(uriStr);
        const hintsUri = vscode.Uri.file(hintsPathFor(doc.uri.fsPath));
        // close any editor tab for the sibling hints file
        for (const group of vscode.window.tabGroups.all) {
          for (const tab of group.tabs) {
            const input = tab.input as { uri?: vscode.Uri } | undefined;
            if (input?.uri && input.uri.toString() === hintsUri.toString()) {
              void vscode.window.tabGroups.close(tab);
            }
          }
        }
      }
    });

    const hoverDisp = vscode.languages.registerHoverProvider(
      CPP_LANGUAGES.map((language) => ({ scheme: 'file', language })),
      { provideHover: (doc, pos) => this.provideHover(doc, pos) }
    );

    this.disposables.push(saveDisp, activeDisp, configDisp, closeDisp, hoverDisp, this.statusBar);

    this.updateHealthTimer();
    this.renderStatus();
    void this.runHealthCheck();
  }

  public deactivate(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }

  private isCppFile(doc: vscode.TextDocument): boolean {
    return CPP_LANGUAGES.includes(doc.languageId);
  }

  private activeIsCpp(): boolean {
    const ed = vscode.window.activeTextEditor;
    return !!ed && this.isCppFile(ed.document);
  }

  // ---------- Status bar / health ----------

  private setStatus(s: StatusState): void {
    this.currentStatus = s;
    this.renderStatus();
  }

  private renderStatus(): void {
    if (!this.llmEnabled) {
      this.statusBar.text = '$(circle-slash) C++→Rust: disabled';
    } else {
      switch (this.currentStatus) {
        case 'online':   this.statusBar.text = '$(check) C++→Rust: online'; break;
        case 'thinking': this.statusBar.text = '$(sync~spin) C++→Rust: thinking…'; break;
        case 'offline':  this.statusBar.text = '$(error) C++→Rust: offline'; break;
        case 'disabled': this.statusBar.text = '$(circle-slash) C++→Rust: disabled'; break;
      }
    }
    if (this.activeIsCpp()) this.statusBar.show();
    else this.statusBar.hide();
  }

  private updateHealthTimer(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    if (!this.llmEnabled) return;
    this.healthTimer = setInterval(() => {
      if (this.activeIsCpp() && this.currentStatus !== 'thinking') void this.runHealthCheck();
    }, this.healthCheckIntervalMs);
  }

  public async runHealthCheck(): Promise<void> {
    if (!this.llmEnabled) {
      this.setStatus('disabled');
      return;
    }
    const ok = await this.llmClient.healthCheck();
    if (this.currentStatus === 'thinking') return;
    this.setStatus(ok ? 'online' : 'offline');
  }

  // ---------- Core processing ----------

  private async processDocument(doc: vscode.TextDocument): Promise<void> {
    if (!this.llmEnabled) {
      this.setStatus('disabled');
      return;
    }

    this.setStatus('thinking');
    const result = await this.llmClient.translate(doc.getText());
    if (!result) {
      this.setStatus('offline');
      return;
    }
    this.setStatus('online');

    const hintsMd = buildHintsFile(doc.uri.fsPath, this.llmModel, result.hintsMarkdown);
    await writeHintsFile(doc.uri.fsPath, hintsMd);
    this.hintsByCppUri.set(doc.uri.toString(), parseHints(result.hintsMarkdown));

    if (this.sideBySide && !this.openedHintsFiles.has(doc.uri.toString())) {
      await this.openHintsEditor(doc);
    }

    this.cargoMirror.scheduleSync(doc.uri.fsPath, result.deps);
  }

  private async openHintsEditor(doc: vscode.TextDocument): Promise<void> {
    const hintsUri = vscode.Uri.file(hintsPathFor(doc.uri.fsPath));
    try {
      await vscode.workspace.fs.stat(hintsUri);
      const openDoc = await vscode.workspace.openTextDocument(hintsUri);
      await vscode.window.showTextDocument(openDoc, {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
        preview: false,
      });
      this.openedHintsFiles.add(doc.uri.toString());
    } catch (err) {
      console.error('[cppToRust] open hints failed:', err);
    }
  }

  private provideHover(doc: vscode.TextDocument, pos: vscode.Position): vscode.Hover | null {
    if (!this.isCppFile(doc)) return null;
    const cache = this.hintsByCppUri.get(doc.uri.toString());
    if (!cache) return null;
    const section = cache.byLine.get(pos.line + 1);
    if (!section) return null;
    const md = new vscode.MarkdownString(section.body);
    md.isTrusted = false;
    return new vscode.Hover(md);
  }

  // ---------- Commands ----------

  public async refreshHints(): Promise<void> {
    const ed = vscode.window.activeTextEditor;
    if (!ed || !this.isCppFile(ed.document)) {
      vscode.window.showWarningMessage('Open a C++ file first.');
      return;
    }
    await this.processDocument(ed.document);
  }

  public async openHints(): Promise<void> {
    const ed = vscode.window.activeTextEditor;
    if (!ed || !this.isCppFile(ed.document)) {
      vscode.window.showWarningMessage('Open a C++ file first.');
      return;
    }
    await this.openHintsEditor(ed.document);
  }

  public async toggleEnabled(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('cppToRust');
    const next = !cfg.get('llmEnabled', true);
    await cfg.update('llmEnabled', next, vscode.ConfigurationTarget.Global);
    this.llmEnabled = next;
    this.updateHealthTimer();
    if (next) void this.runHealthCheck();
    else this.setStatus('disabled');
    vscode.window.showInformationMessage(`C++→Rust: ${next ? 'enabled' : 'disabled'}`);
  }

  public async openCargoProject(): Promise<void> {
    const ed = vscode.window.activeTextEditor;
    if (!ed || !this.isCppFile(ed.document)) {
      vscode.window.showWarningMessage('Open a C++ file first.');
      return;
    }
    const target = resolveTargetForFile(ed.document.uri.fsPath);
    if (!target) {
      vscode.window.showWarningMessage('No CMakeLists.txt ancestor found for this file.');
      return;
    }
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(target.rustRoot), { forceNewWindow: true });
  }
}

// ---------- File helpers ----------

function hintsPathFor(cppPath: string): string {
  const dir = path.dirname(cppPath);
  const base = path.basename(cppPath);
  return path.join(dir, `${base}.hints.md`);
}

function buildHintsFile(cppPath: string, model: string, body: string): string {
  const ts = new Date().toISOString();
  const base = path.basename(cppPath);
  return `# Rust Hints for ${base}\n<!-- generated: ${ts} -->\n<!-- model: ${model} -->\n\n${body.trim()}\n`;
}

async function writeHintsFile(cppPath: string, content: string): Promise<void> {
  const uri = vscode.Uri.file(hintsPathFor(cppPath));
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
}

// ---------- Hint parsing ----------

export function parseHints(markdown: string): HintsCache {
  const sections: HintSection[] = [];
  const lines = markdown.split(/\r?\n/);
  const headingRe = /^##\s+(.+?)\s*<!--\s*anchor:\s*cpp-line-(\d+)\s*-->\s*$/;

  let current: { heading: string; line: number; startIdx: number } | null = null;

  const flush = (endIdx: number) => {
    if (!current) return;
    const body = lines.slice(current.startIdx, endIdx).join('\n').trimEnd();
    sections.push({ heading: current.heading, line: current.line, body });
  };

  for (let i = 0; i < lines.length; i++) {
    const m = headingRe.exec(lines[i]);
    if (m) {
      flush(i);
      current = { heading: m[1].trim(), line: parseInt(m[2], 10), startIdx: i };
    }
  }
  flush(lines.length);

  const byLine = new Map<number, HintSection>();
  for (const s of sections) byLine.set(s.line, s);
  return { sections, byLine };
}
