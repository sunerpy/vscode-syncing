import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  IDataProvider,
  ExtensionsData,
  SettingsData,
  ThemesData,
  SnippetsData,
  ExtensionInfo,
  ThemeInfo,
  SnippetInfo,
} from './interfaces';
import { ErrorHandler, ErrorType } from './errorHandler';
import { logger } from './logger';
import {
  getVSCodeEdition,
  getVSCodeDataDirectory,
  getVSCodeExtensionsDirectory,
  getPlatform,
} from '../utils/vscodeEnvironment';
import { VSCodeEdition, Platform } from '../types/vscodeEdition';

export class DataProvider implements IDataProvider {
  public readonly vscodeEdition: VSCodeEdition;
  public readonly platform: Platform;
  public readonly isPortable: boolean;
  public readonly dataDirectory: string;
  public readonly userDirectory: string;
  public readonly extensionsDirectory: string;
  public readonly userSettingsPath: string;
  public readonly userSnippetsPath: string;

  constructor() {
    this.vscodeEdition = getVSCodeEdition();
    this.platform = getPlatform();
    this.isPortable = !!process.env.VSCODE_PORTABLE;
    this.dataDirectory = getVSCodeDataDirectory();
    this.userDirectory = path.join(this.dataDirectory, 'User');
    this.extensionsDirectory = getVSCodeExtensionsDirectory();
    this.userSettingsPath = path.join(this.userDirectory, 'settings.json');
    this.userSnippetsPath = path.join(this.userDirectory, 'snippets');

    this.logEnvironmentInfo();
  }

  async getExtensions(): Promise<ExtensionsData> {
    try {
      logger.info('开始收集扩展信息');

      // 获取禁用扩展列表
      const userSettings = this.getUserSettings();
      let disabledList: string[] = [];

      if (userSettings) {
        try {
          const settings = JSON.parse(userSettings);
          if (settings['extensions.disabled'] && Array.isArray(settings['extensions.disabled'])) {
            disabledList = settings['extensions.disabled'];
          }
        } catch (error) {
          logger.warn('解析用户设置失败，无法获取禁用扩展列表');
        }
      }

      const extensions = vscode.extensions.all
        .filter((ext) => !ext.packageJSON.isBuiltin)
        .map(
          (ext): ExtensionInfo => ({
            id: ext.id,
            name: ext.packageJSON.displayName || ext.packageJSON.name,
            version: ext.packageJSON.version,
            publisher: ext.packageJSON.publisher,
            description: ext.packageJSON.description || '',
            isActive: ext.isActive,
            enabled: !disabledList.includes(ext.id),
          }),
        );

      logger.info(`收集到 ${extensions.length} 个扩展`);

      return {
        count: extensions.length,
        list: extensions,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw ErrorHandler.createError(ErrorType.EXTENSION, '获取扩展信息失败', error as Error);
    }
  }

  async getSettings(): Promise<SettingsData> {
    try {
      logger.info('开始收集设置信息');

      const settings: SettingsData = {
        timestamp: new Date().toISOString(),
      };

      // 获取用户设置 - 直接保存原始内容，不进行JSON解析
      const userSettings = this.getUserSettings();
      if (userSettings) {
        // 直接保存原始字符串内容，保留注释
        settings.userRaw = userSettings;
        logger.info('用户设置收集完成');
      }

      // 获取工作区设置 - 直接保存原始内容，不进行JSON解析
      const workspaceSettings = this.getWorkspaceSettings();
      if (workspaceSettings) {
        // 直接保存原始字符串内容，保留注释
        settings.workspaceRaw = workspaceSettings;
        logger.info('工作区设置收集完成');
      }

      return settings;
    } catch (error) {
      throw ErrorHandler.createError(ErrorType.FILE_SYSTEM, '获取设置信息失败', error as Error);
    }
  }

  async getThemes(): Promise<ThemesData> {
    try {
      logger.info('开始收集主题信息');

      const config = vscode.workspace.getConfiguration();
      const colorTheme = config.get<string>('workbench.colorTheme');
      const iconTheme = config.get<string>('workbench.iconTheme');
      const productIconTheme = config.get<string>('workbench.productIconTheme');

      // 获取已安装的主题扩展
      const themeExtensions = vscode.extensions.all
        .filter((ext) => {
          const contributes = ext.packageJSON.contributes;
          return (
            contributes &&
            (contributes.themes || contributes.iconThemes || contributes.productIconThemes)
          );
        })
        .map(
          (ext): ThemeInfo => ({
            id: ext.id,
            name: ext.packageJSON.displayName || ext.packageJSON.name,
            themes: ext.packageJSON.contributes?.themes || [],
            iconThemes: ext.packageJSON.contributes?.iconThemes || [],
            productIconThemes: ext.packageJSON.contributes?.productIconThemes || [],
          }),
        );

      logger.info(`收集到 ${themeExtensions.length} 个主题扩展`);

      return {
        current: {
          colorTheme,
          iconTheme,
          productIconTheme,
        },
        available: themeExtensions,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw ErrorHandler.createError(ErrorType.CONFIGURATION, '获取主题信息失败', error as Error);
    }
  }

  async getSnippets(): Promise<SnippetsData> {
    try {
      logger.info('开始收集代码片段信息');

      const snippets: Record<string, SnippetInfo> = {};

      // 获取用户代码片段
      await this.collectUserSnippets(snippets);

      // 获取工作区代码片段
      await this.collectWorkspaceSnippets(snippets);

      logger.info(`收集到 ${Object.keys(snippets).length} 个代码片段文件`);

      return {
        snippets,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw ErrorHandler.createError(ErrorType.FILE_SYSTEM, '获取代码片段信息失败', error as Error);
    }
  }

  private async collectUserSnippets(snippets: Record<string, SnippetInfo>): Promise<void> {
    if (!fs.existsSync(this.userSnippetsPath)) {
      logger.info('用户代码片段目录不存在');
      return;
    }

    const files = fs.readdirSync(this.userSnippetsPath);
    for (const file of files) {
      if (file.endsWith('.code-snippets') || file.endsWith('.json')) {
        const filePath = path.join(this.userSnippetsPath, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const ext = file.endsWith('.code-snippets') ? '.code-snippets' : '.json';
          const language = path.basename(file, ext);
          snippets[language] = { content, ext };
        } catch (error) {
          logger.warn(`读取用户代码片段文件失败: ${file}`);
        }
      }
    }
  }

  private async collectWorkspaceSnippets(snippets: Record<string, SnippetInfo>): Promise<void> {
    if (!vscode.workspace.workspaceFolders) {
      return;
    }

    for (const folder of vscode.workspace.workspaceFolders) {
      const workspaceSnippetsPath = path.join(folder.uri.fsPath, '.vscode', 'snippets');
      if (!fs.existsSync(workspaceSnippetsPath)) {
        continue;
      }

      const files = fs.readdirSync(workspaceSnippetsPath);
      for (const file of files) {
        if (file.endsWith('.code-snippets') || file.endsWith('.json')) {
          const filePath = path.join(workspaceSnippetsPath, file);
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const ext = file.endsWith('.code-snippets') ? '.code-snippets' : '.json';
            const language = `workspace-${path.basename(file, ext)}`;
            snippets[language] = { content, ext };
          } catch (error) {
            logger.warn(`读取工作区代码片段文件失败: ${file}`);
          }
        }
      }
    }
  }

  private getUserSettings(): string | null {
    try {
      if (fs.existsSync(this.userSettingsPath)) {
        return fs.readFileSync(this.userSettingsPath, 'utf8');
      }
    } catch (error) {
      logger.warn(`读取用户设置失败: ${error}`);
    }
    return null;
  }

  private getWorkspaceSettings(): string | null {
    try {
      if (vscode.workspace.workspaceFolders) {
        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        const settingsPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'settings.json');
        if (fs.existsSync(settingsPath)) {
          return fs.readFileSync(settingsPath, 'utf8');
        }
      }
    } catch (error) {
      logger.warn(`读取工作区设置失败: ${error}`);
    }
    return null;
  }

  private logEnvironmentInfo(): void {
    logger.info('=== VSCode 环境信息 ===');
    logger.info(`VSCode 发行版: ${this.vscodeEdition}`);
    logger.info(`操作系统平台: ${this.platform}`);
    logger.info(`便携模式: ${this.isPortable ? '是' : '否'}`);
    logger.info(`数据目录: ${this.dataDirectory}`);
    logger.info(`用户目录: ${this.userDirectory}`);
    logger.info(`扩展目录: ${this.extensionsDirectory}`);
    logger.info(`用户设置路径: ${this.userSettingsPath}`);
    logger.info(`用户代码片段路径: ${this.userSnippetsPath}`);
    logger.info(`vscode.env.appRoot: ${vscode.env.appRoot}`);
    logger.info(`vscode.env.appName: ${vscode.env.appName}`);

    // 添加 Remote-SSH 特定信息
    if (this.vscodeEdition === VSCodeEdition.REMOTE_SSH) {
      logger.info('=== Remote-SSH 环境信息 ===');
      logger.info(`VSCODE_AGENT_FOLDER: ${process.env['VSCODE_AGENT_FOLDER'] || '未设置'}`);
      logger.info(`VSCODE_SSH_HOST: ${process.env['VSCODE_SSH_HOST'] || '未设置'}`);
      logger.info(`REMOTE_SSH_EXTENSION: ${process.env['REMOTE_SSH_EXTENSION'] || '未设置'}`);
      logger.info(
        `Remote-SSH 扩展已安装: ${vscode.extensions.getExtension('ms-vscode-remote.remote-ssh') ? '是' : '否'}`,
      );
      logger.info('=== Remote-SSH 环境信息结束 ===');
    }

    logger.info('=== 环境信息结束 ===');
  }

  public getUserSettingsPath(): string {
    return this.userSettingsPath;
  }

  public getUserSnippetsPath(): string {
    return this.userSnippetsPath;
  }
}
