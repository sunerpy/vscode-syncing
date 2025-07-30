import * as vscode from 'vscode';
import { SyncManager } from './core/syncManager';
import { ConfigurationManager } from './core/configurationManager';
import { ReloadStatusBar } from './statusBar';
import { logger } from './core/logger';
import { ErrorHandler } from './core/errorHandler';

export function activate(context: vscode.ExtensionContext) {
  try {
    logger.info('VSCode Syncing 扩展开始激活');

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

    // 初始化配置管理器
    const configManager = new ConfigurationManager();

    // 注册导出命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vscode-syncing.exportAll', async () => {
        await ErrorHandler.handleAsync(() => syncManager.exportAll(), 'ExportAll');
      }),
      vscode.commands.registerCommand('vscode-syncing.exportExtensions', async () => {
        await ErrorHandler.handleAsync(() => syncManager.exportExtensions(), 'ExportExtensions');
      }),
      vscode.commands.registerCommand('vscode-syncing.exportSettings', async () => {
        await ErrorHandler.handleAsync(() => syncManager.exportSettings(), 'ExportSettings');
      }),
      vscode.commands.registerCommand('vscode-syncing.exportThemes', async () => {
        await ErrorHandler.handleAsync(() => syncManager.exportThemes(), 'ExportThemes');
      }),
      vscode.commands.registerCommand('vscode-syncing.exportSnippets', async () => {
        await ErrorHandler.handleAsync(() => syncManager.exportSnippets(), 'ExportSnippets');
      }),
    );

    // 注册导入命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vscode-syncing.importAll', async () => {
        await ErrorHandler.handleAsync(() => syncManager.importAll(), 'ImportAll');
      }),
      vscode.commands.registerCommand('vscode-syncing.importExtensions', async () => {
        await ErrorHandler.handleAsync(() => syncManager.importExtensions(), 'ImportExtensions');
      }),
      vscode.commands.registerCommand('vscode-syncing.importSettings', async () => {
        await ErrorHandler.handleAsync(() => syncManager.importSettings(), 'ImportSettings');
      }),
      vscode.commands.registerCommand('vscode-syncing.importThemes', async () => {
        await ErrorHandler.handleAsync(() => syncManager.importThemes(), 'ImportThemes');
      }),
      vscode.commands.registerCommand('vscode-syncing.importSnippets', async () => {
        await ErrorHandler.handleAsync(() => syncManager.importSnippets(), 'ImportSnippets');
      }),
    );

    // 注册配置命令
    context.subscriptions.push(
      vscode.commands.registerCommand('vscode-syncing.configureExport', async () => {
        await ErrorHandler.handleAsync(
          () => configManager.showConfigurationWizard(),
          'ConfigureExport',
        );
      }),
    );

    // 注册Hello World命令（保持兼容性）
    context.subscriptions.push(
      vscode.commands.registerCommand('vscode-syncing.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from vscode-syncing!');
      }),
    );

    logger.info('VSCode Syncing 扩展激活完成');
  } catch (error) {
    ErrorHandler.handle(error as Error, 'ExtensionActivation');
  }
}

export function deactivate() {
  logger.info('VSCode Syncing 扩展已停用');
  logger.dispose();
}
