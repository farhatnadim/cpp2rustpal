import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface CargoTarget {
  cppRoot: string;
  rustRoot: string;
  rustRootBasename: string;
  parentDir: string;
}

export function findCppRoot(cppFilePath: string, workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined): string | null {
  if (!workspaceFolders || workspaceFolders.length === 0) return null;
  const inWorkspace = workspaceFolders.some((f) => cppFilePath.startsWith(f.uri.fsPath + path.sep) || cppFilePath === f.uri.fsPath);
  if (!inWorkspace) return null;

  let dir = path.dirname(cppFilePath);
  const workspaceRoots = workspaceFolders.map((f) => f.uri.fsPath);
  while (true) {
    if (fs.existsSync(path.join(dir, 'CMakeLists.txt'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    // stop when we've climbed above every workspace folder
    if (!workspaceRoots.some((r) => dir.startsWith(r))) return null;
    dir = parent;
  }
}

export function resolveTarget(cppRoot: string): CargoTarget {
  const parentDir = path.dirname(cppRoot);
  const basename = path.basename(cppRoot);
  const rustRootBasename = basename.startsWith('cpp_')
    ? `rust_${basename.slice(4)}`
    : `rust_${basename}`;
  const rustRoot = path.join(parentDir, rustRootBasename);
  return { cppRoot, rustRoot, rustRootBasename, parentDir };
}

export function resolveTargetForFile(cppFilePath: string): CargoTarget | null {
  const cppRoot = findCppRoot(cppFilePath, vscode.workspace.workspaceFolders);
  if (!cppRoot) return null;
  return resolveTarget(cppRoot);
}

export class CargoMirror {
  private inFlight: Map<string, Promise<void>> = new Map();

  enabled(): boolean {
    return vscode.workspace.getConfiguration('cppToRust').get('cargoMirrorEnabled', true);
  }

  scheduleSync(cppFilePath: string, deps: string[]): void {
    if (!this.enabled()) return;
    const target = resolveTargetForFile(cppFilePath);
    if (!target) return;

    const key = target.rustRoot;
    const prev = this.inFlight.get(key) ?? Promise.resolve();
    const next = prev.then(() => this.sync(target, deps)).catch((err) => {
      console.error('[cppToRust] cargo mirror error:', err);
    });
    this.inFlight.set(
      key,
      next.finally(() => {
        if (this.inFlight.get(key) === next) this.inFlight.delete(key);
      })
    );
  }

  private async sync(target: CargoTarget, deps: string[]): Promise<void> {
    const cargoToml = path.join(target.rustRoot, 'Cargo.toml');
    if (!fs.existsSync(cargoToml)) {
      try {
        await execFileAsync('cargo', ['new', '--bin', target.rustRootBasename], { cwd: target.parentDir });
      } catch (err) {
        console.error('[cppToRust] cargo new failed:', err);
        return;
      }
    }

    if (deps.length === 0) return;
    let existing = '';
    try { existing = fs.readFileSync(cargoToml, 'utf8'); } catch { return; }

    const missing = deps.filter((d) => !hasDependency(existing, d));
    for (const crate of missing) {
      try {
        await execFileAsync('cargo', ['add', crate], { cwd: target.rustRoot });
      } catch (err) {
        console.error(`[cppToRust] cargo add ${crate} failed:`, err);
      }
    }
  }
}

function hasDependency(cargoToml: string, crate: string): boolean {
  const re = new RegExp(`^\\s*${escapeRegex(crate)}\\s*=`, 'm');
  return re.test(cargoToml);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
