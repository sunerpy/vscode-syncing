// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ReloadStatusBar } from './statusBar';
import { SyncManager } from './syncManager';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // 创建状态栏重载按钮
  const reloadBar = new ReloadStatusBar();
  context.subscriptions.push(reloadBar);

  // 注册重载命令
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-syncing.reloadWindow', () => {
      reloadBar.reset();
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }),
  );

  // 初始化主控制器
  const syncManager = new SyncManager(reloadBar);
  context.subscriptions.push(syncManager);

  // 注册其它命令（如导入/导出等）
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-syncing.exportAll', () => syncManager.exportAll()),
    vscode.commands.registerCommand('vscode-syncing.importAll', () => syncManager.importAll()),
    vscode.commands.registerCommand('vscode-syncing.exportExtensions', () =>
      syncManager.exportExtensions(),
    ),
    vscode.commands.registerCommand('vscode-syncing.importExtensions', () =>
      syncManager.importExtensions(),
    ),
    vscode.commands.registerCommand('vscode-syncing.exportSettings', () =>
      syncManager.exportSettings(),
    ),
    vscode.commands.registerCommand('vscode-syncing.importSettings', () =>
      syncManager.importSettings(),
    ),
    vscode.commands.registerCommand('vscode-syncing.exportThemes', () =>
      syncManager.exportThemes(),
    ),
    vscode.commands.registerCommand('vscode-syncing.importThemes', () =>
      syncManager.importThemes(),
    ),
    vscode.commands.registerCommand('vscode-syncing.exportSnippets', () =>
      syncManager.exportSnippets(),
    ),
    vscode.commands.registerCommand('vscode-syncing.importSnippets', () =>
      syncManager.importSnippets(),
    ),
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
