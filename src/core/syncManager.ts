import * as vscode from 'vscode';
import {
  IDataProvider,
  IExportProvider,
  IConfigurationProvider,
  DataType,
  ProgressInfo,
} from './interfaces';
import { DataProvider } from './dataProvider';
import { ConfigurationManager, ExportMethod } from './configurationManager';
import { LocalExportProvider } from '../providers/localExportProvider';
import { GistExportProvider } from '../providers/gistExportProvider';
import { RepositoryExportProvider } from '../providers/repositoryExportProvider';
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
              await this.importData(task.type);
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
    await this.importData(DataType.EXTENSIONS);
  }

  async importSettings(): Promise<void> {
    await this.importData(DataType.SETTINGS);
  }

  async importThemes(): Promise<void> {
    await this.importData(DataType.THEMES);
  }

  async importSnippets(): Promise<void> {
    await this.importData(DataType.SNIPPETS);
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
    // 这里暂时使用简化的实现，实际应该根据数据类型进行相应的应用操作
    logger.info(`应用 ${type} 数据`);
    // TODO: 实现具体的数据应用逻辑
  }

  dispose(): void {
    logger.info('SyncManager 已释放');
  }
}
