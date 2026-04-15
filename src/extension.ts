import * as vscode from 'vscode';
import { FeatureDetector } from './feature-detector';

let featureDetector: FeatureDetector | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log('C++ to Rust Translator extension is now active!');

  featureDetector = new FeatureDetector(context);
  featureDetector.activate();

  // Register commands
  const translateCommand = vscode.commands.registerCommand(
    'cppToRust.translate',
    () => featureDetector?.translateCurrentFile()
  );

  const openRustCommand = vscode.commands.registerCommand(
    'cppToRust.openRustEditor',
    () => featureDetector?.openRustEditorForCurrent()
  );

  const toggleAutoCommand = vscode.commands.registerCommand(
    'cppToRust.toggleAutoUpdate',
    () => featureDetector?.toggleAutoUpdate()
  );

  context.subscriptions.push(
    translateCommand,
    openRustCommand,
    toggleAutoCommand
  );
}

export function deactivate(): void {
  featureDetector?.deactivate();
  featureDetector = undefined;
}
