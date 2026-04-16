import * as vscode from 'vscode';
import { FeatureDetector } from './feature-detector';

let featureDetector: FeatureDetector | undefined;

export function activate(context: vscode.ExtensionContext): void {
  featureDetector = new FeatureDetector(context);
  featureDetector.activate();

  context.subscriptions.push(
    vscode.commands.registerCommand('cppToRust.refreshHints', () => featureDetector?.refreshHints()),
    vscode.commands.registerCommand('cppToRust.openHints', () => featureDetector?.openHints()),
    vscode.commands.registerCommand('cppToRust.toggleEnabled', () => featureDetector?.toggleEnabled()),
    vscode.commands.registerCommand('cppToRust.openCargoProject', () => featureDetector?.openCargoProject()),
    vscode.commands.registerCommand('cppToRust.pickModel', () => featureDetector?.pickModel()),
    vscode.commands.registerCommand('cppToRust.retryHealth', () => featureDetector?.runHealthCheck())
  );
}

export function deactivate(): void {
  featureDetector?.deactivate();
  featureDetector = undefined;
}
