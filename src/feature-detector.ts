import * as vscode from 'vscode';
import * as path from 'path';
import { detectFeatures, generateRustContent } from './concept-mapper';
import { LlmClient } from './llm-client';

const DEBOUNCE_MS = 300;

/**
 * Feature Detector - Monitors C++ documents and generates Rust translations.
 * Uses local LLM (llama-server) when available, falls back to static regex.
 */
export class FeatureDetector {
  private disposables: vscode.Disposable[] = [];
  private autoUpdate: boolean = true;
  private showSyntaxHints: boolean = true;
  private showConceptualMapping: boolean = true;
  private sideBySide: boolean = true;
  private llmEnabled: boolean = true;
  private llmEndpoint: string = 'http://localhost:8001';
  private llmModel: string = 'unsloth/Qwen3.5-35B-A3B';
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private openedRustFiles: Set<string> = new Set();
  private llmClient: LlmClient | null = null;
  private statusBar: vscode.StatusBarItem;

  constructor(private context: vscode.ExtensionContext) {
    this.statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.loadSettings();
  }

  private loadSettings(): void {
    const config = vscode.workspace.getConfiguration('cppToRust');
    this.autoUpdate = config.get('autoUpdate', true);
    this.showSyntaxHints = config.get('showSyntaxHints', true);
    this.showConceptualMapping = config.get('showConceptualMapping', true);
    this.sideBySide = config.get('sideBySide', true);
    this.llmEnabled = config.get('llmEnabled', true);
    this.llmEndpoint = config.get('llmEndpoint', 'http://localhost:8001');
    this.llmModel = config.get('llmModel', 'unsloth/Qwen3.5-35B-A3B');

    if (this.llmEnabled) {
      if (this.llmClient) {
        this.llmClient.updateConfig(this.llmEndpoint, this.llmModel);
      } else {
        this.llmClient = new LlmClient(this.llmEndpoint, this.llmModel);
      }
    } else {
      this.llmClient = null;
    }
  }

  public activate(): void {
    this.loadSettings();

    // Listen to document changes
    const changeDisposable = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        if (this.autoUpdate && this.isCppFile(event.document)) {
          this.scheduleProcess(event.document);
        }
      }
    );

    // Listen to active editor changes
    const editorDisposable = vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor && this.isCppFile(editor.document)) {
          if (this.sideBySide) {
            void this.openRustEditor(editor.document);
          }
        }
      }
    );

    // Listen to configuration changes
    const configDisposable = vscode.workspace.onDidChangeConfiguration(
      (event) => {
        if (event.affectsConfiguration('cppToRust')) {
          this.loadSettings();
          void this.processAllCppFiles();
        }
      }
    );

    this.disposables.push(
      changeDisposable,
      editorDisposable,
      configDisposable,
      this.statusBar
    );
  }

  public deactivate(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }

  private scheduleProcess(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      void this.processDocument(document);
    }, DEBOUNCE_MS);
    this.debounceTimers.set(key, timer);
  }

  private isCppFile(document: vscode.TextDocument): boolean {
    const cppLanguages = ['cpp', 'c', 'cuda-cpp'];
    return cppLanguages.includes(document.languageId);
  }

  private async processDocument(document: vscode.TextDocument): Promise<void> {
    try {
      const content = document.getText();
      let rustContent: string;

      if (this.llmEnabled && this.llmClient) {
        // Try LLM first
        this.statusBar.text = '$(sync~spin) C++→Rust: LLM thinking...';
        this.statusBar.show();

        const llmResult = await this.llmClient.translate(content);

        this.statusBar.hide();

        if (llmResult !== null) {
          rustContent = llmResult;
        } else {
          // LLM unavailable — fall back to regex
          rustContent = this.staticTranslate(content);
        }
      } else {
        rustContent = this.staticTranslate(content);
      }

      await this.writeRustFile(document, rustContent);

      // Open side-by-side only once per C++ file
      if (this.sideBySide && !this.openedRustFiles.has(document.uri.toString())) {
        await this.openRustEditor(document);
      }
    } catch (error) {
      this.statusBar.hide();
      console.error('Error processing C++ document:', error);
    }
  }

  private staticTranslate(content: string): string {
    const detectedFeatures = detectFeatures(content);
    return generateRustContent(
      detectedFeatures,
      this.showSyntaxHints,
      this.showConceptualMapping
    );
  }

  private async writeRustFile(
    document: vscode.TextDocument,
    content: string
  ): Promise<void> {
    const cppPath = document.uri.fsPath;
    const rustPath = cppPath.replace(/\.(cpp|c|cc|cxx|hpp|hxx)$/, '.rs');
    const rustUri = vscode.Uri.file(rustPath);

    try {
      const parentDir = vscode.Uri.file(path.dirname(rustPath));
      await vscode.workspace.fs.createDirectory(parentDir);
      const encodedContent = Buffer.from(content, 'utf8');
      await vscode.workspace.fs.writeFile(rustUri, encodedContent);
      console.log(`Updated Rust file: ${rustPath}`);
    } catch (error) {
      if (this.isInWorkspace(document.uri)) {
        await this.writeToWorkspace(document.uri, content);
      } else {
        console.error('Error writing Rust file:', error);
      }
    }
  }

  private isInWorkspace(uri: vscode.Uri): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return false;
    return workspaceFolders.some((folder) =>
      uri.fsPath.startsWith(folder.uri.fsPath)
    );
  }

  private async writeToWorkspace(uri: vscode.Uri, content: string): Promise<void> {
    const rustPath = uri.fsPath.replace(/\.(cpp|c|cc|cxx|hpp|hxx)$/, '.rs');
    const rustUri = vscode.Uri.file(rustPath);
    try {
      const parentDir = vscode.Uri.file(path.dirname(rustPath));
      await vscode.workspace.fs.createDirectory(parentDir);
      const encodedContent = Buffer.from(content, 'utf8');
      await vscode.workspace.fs.writeFile(rustUri, encodedContent);
    } catch (error) {
      console.error('Error writing to workspace:', error);
    }
  }

  private async openRustEditor(document: vscode.TextDocument): Promise<void> {
    const cppPath = document.uri.fsPath;
    const rustPath = cppPath.replace(/\.(cpp|c|cc|cxx|hpp|hxx)$/, '.rs');
    const rustUri = vscode.Uri.file(rustPath);

    try {
      try {
        await vscode.workspace.fs.stat(rustUri);
      } catch {
        await this.writeRustFile(document, '// Rust translation will appear here\n');
      }

      const doc = await vscode.workspace.openTextDocument(rustUri);
      await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
        preview: false,
      });
      this.openedRustFiles.add(document.uri.toString());
    } catch (error) {
      console.error('Error opening Rust editor:', error);
    }
  }

  private async processAllCppFiles(): Promise<void> {
    const documents = vscode.workspace.textDocuments;
    for (const doc of documents) {
      if (this.isCppFile(doc)) {
        await this.processDocument(doc);
      }
    }
  }

  public async translateCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.isCppFile(editor.document)) {
      vscode.window.showWarningMessage(
        'No C++ file open. Please open a C++ file first.'
      );
      return;
    }
    await this.processDocument(editor.document);
    vscode.window.showInformationMessage('C++ to Rust translation complete!');
  }

  public async openRustEditorForCurrent(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.isCppFile(editor.document)) {
      vscode.window.showWarningMessage(
        'No C++ file open. Please open a C++ file first.'
      );
      return;
    }
    await this.openRustEditor(editor.document);
  }

  public async toggleAutoUpdate(): Promise<void> {
    const config = vscode.workspace.getConfiguration('cppToRust');
    const newValue = !config.get('autoUpdate', true);
    await config.update('autoUpdate', newValue, vscode.ConfigurationTarget.Global);
    this.autoUpdate = newValue;

    if (newValue) {
      vscode.window.showInformationMessage('C++→Rust: Auto-update enabled');
      const editor = vscode.window.activeTextEditor;
      if (editor && this.isCppFile(editor.document)) {
        await this.processDocument(editor.document);
      }
    } else {
      vscode.window.showInformationMessage('C++→Rust: Auto-update disabled');
    }
  }
}
