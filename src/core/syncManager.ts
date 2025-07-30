import * as vscode from 'vscode';
import {
  IDataProvider,
  IExportProvider,
  IConfigurationProvider,
  DataType,
  ProgressInfo,
  ExtensionsData,
  SettingsData,
  ThemesData,
  SnippetsData,
} from './interfaces';
import { DataProvider } from './dataProvider';
import { ConfigurationManager, ExportMethod } from './configurationManager';
import { LocalExportProvider } from '../providers/localExportProvider';
import { GistExportProvider } from '../providers/gistExportProvider';
import { RepositoryExportProvider } from '../providers/repositoryExportProvider';
import { ExtensionManager } from './extensionManager';
import { ReportManager, ImportResult, ExtensionImportResult } from './reportManager';
import { ErrorHandler, ErrorType } from './errorHandler';
import { logger } from './logger';
import { ReloadStatusBar } from '../statusBar';

export class SyncManager {
  private dataProvider: IDataProvider;
  private configManager: IConfigurationProvider;
  private reloadBar: ReloadStatusBar;

  constructor(reloadBar: ReloadStatusBar) {
    this.dataProvider = new DataProvider();
    this.configManager = new ConfigurationManager();
    this.reloadBar = reloadBar;

    logger.info('SyncManager 初始化完成');
  }

  async exportAll(): Promise<void> {
    try {
      logger.info('开始导出所有配置');

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '正在导出所有配置...',
          cancellable: false,
        },
        async (progress) => {
          const tasks = [
            { type: DataType.EXTENSIONS, message: '导出扩展' },
            { type: DataType.SETTINGS, message: '导出设置' },
            { type: DataType.THEMES, message: '导出主题' },
            { type: DataType.SNIPPETS, message: '导出代码片段' },
          ];

          for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            progress.report({
              increment: (i / tasks.length) * 100,
              message: task.message,
            });

            await this.exportData(task.type);
            logger.info(`${task.message}完成`);
          }

          progress.report({ increment: 100, message: '所有配置导出完成!' });
        },
      );

      const exportPath = await this.getExportPath();
      vscode.window.showInformationMessage(`所有配置导出成功！路径: ${exportPath}`);
      logger.info('所有配置导出完成');
    } catch (error) {
      ErrorHandler.handle(error as Error, 'ExportAll');
    }
  }

  async exportExtensions(): Promise<void> {
    await this.exportData(DataType.EXTENSIONS);
  }

  async exportSettings(): Promise<void> {
    await this.exportData(DataType.SETTINGS);
  }

  async exportThemes(): Promise<void> {
    await this.exportData(DataType.THEMES);
  }

  async exportSnippets(): Promise<void> {
    await this.exportData(DataType.SNIPPETS);
  }

  async importAll(): Promise<void> {
    try {
      logger.info('开始导入所有配置');

      // 显示覆盖警告
      const confirmed = await this.showImportWarning('所有配置');
      if (!confirmed) {
        logger.info('用户取消了导入所有配置');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '正在导入所有配置...',
          cancellable: false,
        },
        async (progress) => {
          const tasks = [
            { type: DataType.EXTENSIONS, message: '导入扩展' },
            { type: DataType.SETTINGS, message: '导入设置' },
            { type: DataType.THEMES, message: '导入主题' },
            { type: DataType.SNIPPETS, message: '导入代码片段' },
          ];

          for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            progress.report({
              increment: (i / tasks.length) * 100,
              message: task.message,
            });

            try {
              await this.importDataInternal(task.type);
              logger.info(`${task.message}完成`);
            } catch (error) {
              logger.warn(`${task.message}失败: ${error}`);
            }
          }

          progress.report({ increment: 100, message: '导入完成!' });
        },
      );

      vscode.window.showInformationMessage('所有配置导入成功！');
      logger.info('所有配置导入完成');
    } catch (error) {
      ErrorHandler.handle(error as Error, 'ImportAll');
    }
  }

  async importExtensions(): Promise<void> {
    const confirmed = await this.showImportWarning('扩展');
    if (confirmed) {
      await this.importDataInternal(DataType.EXTENSIONS);
    }
  }

  async importSettings(): Promise<void> {
    const confirmed = await this.showImportWarning('设置');
    if (confirmed) {
      await this.importDataInternal(DataType.SETTINGS);
    }
  }

  async importThemes(): Promise<void> {
    const confirmed = await this.showImportWarning('主题');
    if (confirmed) {
      await this.importDataInternal(DataType.THEMES);
    }
  }

  async importSnippets(): Promise<void> {
    const confirmed = await this.showImportWarning('代码片段');
    if (confirmed) {
      await this.importDataInternal(DataType.SNIPPETS);
    }
  }

  private async exportData(type: DataType): Promise<string> {
    try {
      logger.info(`开始导出 ${type}`);

      // 验证配置
      const validation = await this.configManager.validate();
      if (!validation.isValid) {
        throw ErrorHandler.createError(
          ErrorType.CONFIGURATION,
          `配置验证失败: ${validation.errors.join(', ')}`,
        );
      }

      // 获取数据
      let data;
      switch (type) {
        case DataType.EXTENSIONS:
          data = await this.dataProvider.getExtensions();
          break;
        case DataType.SETTINGS:
          data = await this.dataProvider.getSettings();
          break;
        case DataType.THEMES:
          data = await this.dataProvider.getThemes();
          break;
        case DataType.SNIPPETS:
          data = await this.dataProvider.getSnippets();
          break;
      }

      // 导出数据
      const exportProvider = this.getExportProvider();
      const exportPath = await exportProvider.export(data, type);

      logger.info(`${type} 导出成功: ${exportPath}`);
      vscode.window.showInformationMessage(
        `${this.getTypeDisplayName(type)}导出成功！路径: ${exportPath}`,
      );

      return exportPath;
    } catch (error) {
      const message = `导出${this.getTypeDisplayName(type)}失败`;
      ErrorHandler.handle(error as Error, `Export${type}`);
      throw ErrorHandler.createError(ErrorType.UNKNOWN, message, error as Error);
    }
  }

  private async importData(type: DataType): Promise<void> {
    try {
      logger.info(`开始导入 ${type}`);

      // 验证配置
      const validation = await this.configManager.validate();
      if (!validation.isValid) {
        throw ErrorHandler.createError(
          ErrorType.CONFIGURATION,
          `配置验证失败: ${validation.errors.join(', ')}`,
        );
      }

      // 导入数据
      const exportProvider = this.getExportProvider();
      const data = await exportProvider.import(type);

      // 应用数据
      await this.applyData(data, type);

      logger.info(`${type} 导入成功`);
      vscode.window.showInformationMessage(`${this.getTypeDisplayName(type)}导入成功！`);
    } catch (error) {
      const message = `导入${this.getTypeDisplayName(type)}失败`;
      ErrorHandler.handle(error as Error, `Import${type}`);
      throw ErrorHandler.createError(ErrorType.UNKNOWN, message, error as Error);
    }
  }

  private getExportProvider(): IExportProvider {
    const config = this.configManager.getConfiguration();

    switch (config.exportMethod) {
      case ExportMethod.LOCAL:
        return new LocalExportProvider(config);
      case ExportMethod.GIST:
        return new GistExportProvider(config);
      case ExportMethod.REPOSITORY:
        return new RepositoryExportProvider(config);
      default:
        throw ErrorHandler.createError(
          ErrorType.CONFIGURATION,
          `不支持的导出方式: ${config.exportMethod}`,
        );
    }
  }

  private async getExportPath(): Promise<string> {
    const config = this.configManager.getConfiguration();

    switch (config.exportMethod) {
      case ExportMethod.LOCAL:
        return config.localPath || '本地路径未配置';
      case ExportMethod.GIST:
        const gistId = config.gistId;
        return gistId ? `https://gist.github.com/${gistId}` : 'GitHub Gist';
      case ExportMethod.REPOSITORY:
        const repoName = config.repositoryName;
        const branch = config.repositoryBranch || 'main';
        return repoName ? `https://github.com/${repoName}/tree/${branch}` : 'GitHub 仓库';
      default:
        return '未知导出方式';
    }
  }

  private getTypeDisplayName(type: DataType): string {
    switch (type) {
      case DataType.EXTENSIONS:
        return '扩展';
      case DataType.SETTINGS:
        return '设置';
      case DataType.THEMES:
        return '主题';
      case DataType.SNIPPETS:
        return '代码片段';
      default:
        return '配置';
    }
  }

  private async applyData(data: any, type: DataType): Promise<void> {
    logger.info(`开始应用 ${type} 数据`);

    switch (type) {
      case DataType.EXTENSIONS:
        await this.applyExtensionsData(data as ExtensionsData);
        break;
      case DataType.SETTINGS:
        await this.applySettingsData(data as SettingsData);
        break;
      case DataType.THEMES:
        await this.applyThemesData(data as ThemesData);
        break;
      case DataType.SNIPPETS:
        await this.applySnippetsData(data as SnippetsData);
        break;
      default:
        logger.warn(`未知的数据类型: ${type}`);
    }

    logger.info(`${type} 数据应用完成`);
  }

  /**
   * 应用扩展数据
   */
  private async applyExtensionsData(extensionsData: ExtensionsData): Promise<void> {
    logger.info(`开始应用扩展数据，共 ${extensionsData.list.length} 个扩展`);

    const extensionManager = new ExtensionManager();

    // 比较本地和远程扩展
    const comparisons = await extensionManager.compareExtensions(extensionsData);

    // 生成比较报告
    const report = extensionManager.generateComparisonReport(comparisons);
    logger.info(`扩展比较报告:\n${report}`);

    // 检查是否有需要处理的扩展
    const hasChanges = comparisons.some(
      (c) => c.needsInstall || c.needsVersionUpdate || c.needsEnableDisable,
    );

    if (!hasChanges) {
      vscode.window.showInformationMessage('所有扩展都是最新状态，无需更改。');
      return;
    }

    // 生成简化摘要
    const summary = extensionManager.generateComparisonSummary(comparisons);

    // 显示简化摘要并询问用户是否继续
    let finalChoice = await vscode.window.showInformationMessage(
      `发现扩展差异，需要：${summary}\n\n是否继续同步？`,
      { modal: true },
      '继续同步',
      '查看详情',
    );

    if (finalChoice === '查看详情') {
      // 显示详细报告
      const detailChoice = await vscode.window.showInformationMessage(
        report,
        { modal: true },
        '继续同步',
      );
      finalChoice = detailChoice === '继续同步' ? '继续同步' : undefined;
    }

    if (finalChoice !== '继续同步') {
      logger.info('用户取消了扩展同步');
      return;
    }

    // 在进度条中应用扩展更改并收集结果
    const extensionResults = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在同步扩展...',
        cancellable: false,
      },
      async (progress) => {
        return await extensionManager.applyExtensionChanges(comparisons, progress);
      },
    );

    // 生成并显示报告
    const reportManager = new ReportManager();
    const importResults: ImportResult[] = [
      {
        type: DataType.EXTENSIONS,
        success: extensionResults.every((r) => r.success),
        message: `处理了 ${extensionResults.length} 个扩展`,
        details: extensionResults,
      },
    ];

    await reportManager.generateImportReport(
      'single',
      [DataType.EXTENSIONS],
      importResults,
      extensionResults,
    );

    // 检查是否有需要禁用的扩展
    await this.handleExtensionsToDisable(extensionResults);

    // 提示用户重新加载窗口
    const needsReload = comparisons.some((c) => c.needsInstall || c.needsVersionUpdate);
    if (needsReload) {
      const reloadChoice = await vscode.window.showInformationMessage(
        '扩展同步完成！需要重新加载窗口以使更改生效。',
        '重新加载',
        '稍后重新加载',
      );

      if (reloadChoice === '重新加载') {
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    }
  }

  /**
   * 应用设置数据
   */
  private async applySettingsData(settingsData: SettingsData): Promise<void> {
    logger.info('开始应用设置数据');

    try {
      // 应用用户设置
      if (settingsData.userRaw) {
        const dataProvider = this.dataProvider as any;
        const userSettingsPath = dataProvider.userSettingsPath;

        const fs = await import('fs');
        fs.writeFileSync(userSettingsPath, settingsData.userRaw, 'utf8');
        logger.info('用户设置已更新');
      }

      // 应用工作区设置
      if (settingsData.workspaceRaw && vscode.workspace.workspaceFolders) {
        const path = await import('path');
        const fs = await import('fs');

        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
        const settingsPath = path.join(vscodeDir, 'settings.json');

        // 确保 .vscode 目录存在
        if (!fs.existsSync(vscodeDir)) {
          fs.mkdirSync(vscodeDir, { recursive: true });
        }

        fs.writeFileSync(settingsPath, settingsData.workspaceRaw, 'utf8');
        logger.info('工作区设置已更新');
      }

      vscode.window.showInformationMessage('设置同步完成！');
    } catch (error) {
      logger.error('应用设置数据失败', error as Error);
      throw error;
    }
  }

  /**
   * 应用主题数据
   */
  private async applyThemesData(themesData: ThemesData): Promise<void> {
    logger.info('开始应用主题数据');

    try {
      const config = vscode.workspace.getConfiguration();

      // 应用颜色主题
      if (themesData.current.colorTheme) {
        await config.update(
          'workbench.colorTheme',
          themesData.current.colorTheme,
          vscode.ConfigurationTarget.Global,
        );
        logger.info(`颜色主题已设置为: ${themesData.current.colorTheme}`);
      }

      // 应用图标主题
      if (themesData.current.iconTheme) {
        await config.update(
          'workbench.iconTheme',
          themesData.current.iconTheme,
          vscode.ConfigurationTarget.Global,
        );
        logger.info(`图标主题已设置为: ${themesData.current.iconTheme}`);
      }

      // 应用产品图标主题
      if (themesData.current.productIconTheme) {
        await config.update(
          'workbench.productIconTheme',
          themesData.current.productIconTheme,
          vscode.ConfigurationTarget.Global,
        );
        logger.info(`产品图标主题已设置为: ${themesData.current.productIconTheme}`);
      }

      vscode.window.showInformationMessage('主题同步完成！');
    } catch (error) {
      logger.error('应用主题数据失败', error as Error);
      throw error;
    }
  }

  /**
   * 应用代码片段数据
   */
  private async applySnippetsData(snippetsData: SnippetsData): Promise<void> {
    logger.info(`开始应用代码片段数据，共 ${Object.keys(snippetsData.snippets).length} 个文件`);

    try {
      const path = await import('path');
      const fs = await import('fs');

      const dataProvider = this.dataProvider as any;
      const userSnippetsPath = dataProvider.userSnippetsPath;

      // 确保代码片段目录存在
      if (!fs.existsSync(userSnippetsPath)) {
        fs.mkdirSync(userSnippetsPath, { recursive: true });
      }

      // 写入代码片段文件
      for (const [fileName, snippet] of Object.entries(snippetsData.snippets)) {
        // 跳过工作区代码片段（以 workspace- 开头的）
        if (fileName.startsWith('workspace-')) {
          logger.info(`跳过工作区代码片段: ${fileName}`);
          continue;
        }

        const snippetFilePath = path.join(userSnippetsPath, `${fileName}${snippet.ext}`);
        fs.writeFileSync(snippetFilePath, snippet.content, 'utf8');
        logger.info(`代码片段已更新: ${snippetFilePath}`);
      }

      vscode.window.showInformationMessage('代码片段同步完成！');
    } catch (error) {
      logger.error('应用代码片段数据失败', error as Error);
      throw error;
    }
  }

  /**
   * 显示导入警告
   */
  private async showImportWarning(dataType: string): Promise<boolean> {
    const message = `⚠️ 导入${dataType}将覆盖本地配置！是否继续？`;

    const choice = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      '继续导入',
      '取消',
    );

    return choice === '继续导入';
  }

  /**
   * 内部导入数据方法（不显示警告）
   */
  private async importDataInternal(type: DataType): Promise<void> {
    try {
      logger.info(`开始导入 ${type}`);

      // 验证配置
      const validation = await this.configManager.validate();
      if (!validation.isValid) {
        throw ErrorHandler.createError(
          ErrorType.CONFIGURATION,
          `配置验证失败: ${validation.errors.join(', ')}`,
        );
      }

      // 导入数据
      const exportProvider = this.getExportProvider();
      const data = await exportProvider.import(type);

      // 应用数据
      await this.applyData(data, type);

      logger.info(`${type} 导入成功`);
      vscode.window.showInformationMessage(`${this.getTypeDisplayName(type)}导入成功！`);
    } catch (error) {
      const message = `导入${this.getTypeDisplayName(type)}失败`;
      ErrorHandler.handle(error as Error, `Import${type}`);
      throw ErrorHandler.createError(ErrorType.UNKNOWN, message, error as Error);
    }
  }

  /**
   * 处理需要状态变更的扩展
   */
  private async handleExtensionsToDisable(
    extensionResults: ExtensionImportResult[],
  ): Promise<void> {
    // 找出所有需要状态变更的扩展（启用或禁用）
    const extensionsToToggle = extensionResults.filter(
      (result) => (result.action === 'enable' || result.action === 'disable') && !result.success,
    );

    if (extensionsToToggle.length === 0) {
      return;
    }

    logger.info(`发现 ${extensionsToToggle.length} 个需要手动更改状态的扩展`);

    // 按操作类型分组
    const toEnable = extensionsToToggle.filter((ext) => ext.action === 'enable');
    const toDisable = extensionsToToggle.filter((ext) => ext.action === 'disable');

    let message = `有 ${extensionsToToggle.length} 个扩展需要手动更改状态：\n\n`;

    if (toEnable.length > 0) {
      message += `启用 ${toEnable.length} 个扩展\n`;
      // 只显示前2个扩展名
      const showCount = Math.min(2, toEnable.length);
      for (let i = 0; i < showCount; i++) {
        message += `• ${toEnable[i].name}\n`;
      }
      if (toEnable.length > 2) {
        message += `• ...还有 ${toEnable.length - 2} 个\n`;
      }
      message += '\n';
    }

    if (toDisable.length > 0) {
      message += `禁用 ${toDisable.length} 个扩展\n`;
      // 只显示前2个扩展名
      const showCount = Math.min(2, toDisable.length);
      for (let i = 0; i < showCount; i++) {
        message += `• ${toDisable[i].name}\n`;
      }
      if (toDisable.length > 2) {
        message += `• ...还有 ${toDisable.length - 2} 个\n`;
      }
    }

    message += '\n是否打开扩展面板手动处理？';

    const choice = await vscode.window.showInformationMessage(
      message,
      { modal: true },
      '打开扩展面板',
      '稍后处理',
    );

    if (choice === '打开扩展面板') {
      // 打开扩展面板
      await vscode.commands.executeCommand('workbench.view.extensions');
    }
  }

  dispose(): void {
    logger.info('SyncManager 已释放');
  }
}
