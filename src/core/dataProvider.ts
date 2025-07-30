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
  getVSCodeExtensionsStateFilePath,
  getPlatform,
  VSCODE_FILE_NAMES,
} from '../utils/vscodeEnvironment';
import { isExtensionIgnored } from '../types/constants';
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
    this.userSettingsPath = path.join(this.userDirectory, VSCODE_FILE_NAMES.USER_SETTINGS);
    this.userSnippetsPath = path.join(this.userDirectory, VSCODE_FILE_NAMES.SNIPPETS_DIR);

    this.logEnvironmentInfo();
  }

  async getExtensions(): Promise<ExtensionsData> {
    try {
      logger.info('开始收集扩展信息');

      // 获取禁用扩展列表 - 使用多种方法确保准确性
      const config = vscode.workspace.getConfiguration();
      const configDisabledList = config.get<string[]>('extensions.disabled', []);

      // 尝试从扩展状态文件中获取更详细的信息
      const extensionStateInfo = await this.getExtensionStateInfo();

      // 读取 extensions.json 文件进行对比分析
      const extensionsJsonData = await this.getExtensionsJsonData();

      logger.info(
        `从配置中发现 ${configDisabledList.length} 个禁用的扩展: ${configDisabledList.join(', ')}`,
      );
      if (extensionStateInfo.disabledExtensions.length > 0) {
        logger.info(
          `从状态文件中发现 ${extensionStateInfo.disabledExtensions.length} 个禁用的扩展: ${extensionStateInfo.disabledExtensions.join(', ')}`,
        );
      }
      logger.info(`从 extensions.json 中发现 ${extensionsJsonData.length} 个扩展`);

      // 获取所有扩展（包括内置扩展）
      const allExtensions = vscode.extensions.all;
      const userInstalledExtensions = allExtensions.filter(
        (ext) => !ext.packageJSON.isBuiltin && !isExtensionIgnored(ext.id),
      );
      const builtinExtensions = allExtensions.filter(
        (ext) => ext.packageJSON.isBuiltin && !isExtensionIgnored(ext.id),
      );

      logger.info(`VSCode API 检测到总计 ${allExtensions.length} 个扩展:`);
      logger.info(`  - 用户安装的扩展: ${userInstalledExtensions.length} 个`);
      logger.info(`  - 内置扩展: ${builtinExtensions.length} 个`);

      // 列举一些内置扩展供用户排查
      logger.info(`内置扩展示例 (前10个):`);
      builtinExtensions.slice(0, 10).forEach((ext) => {
        logger.info(`  - ${ext.id} (${ext.packageJSON.displayName || ext.packageJSON.name})`);
      });

      // 从文件系统获取扩展目录列表，用于比较和发现差异
      const fileSystemExtensionData = await this.getExtensionDataFromFileSystem();
      logger.info(`文件系统检测到 ${fileSystemExtensionData.length} 个扩展目录`);

      // 对比 extensions.json 和 API 获取到的状态（大小写不敏感）
      const filteredExtensionsJsonData = extensionsJsonData.filter(
        (ext) => !isExtensionIgnored(ext.identifier.id),
      );

      const extensionsJsonIds = new Set(
        filteredExtensionsJsonData.map((ext) => ext.identifier.id.toLowerCase()),
      );
      const apiExtensionIds = new Set(userInstalledExtensions.map((ext) => ext.id.toLowerCase()));

      const onlyInExtensionsJson = filteredExtensionsJsonData.filter(
        (ext) => !apiExtensionIds.has(ext.identifier.id.toLowerCase()),
      );
      const onlyInApi = userInstalledExtensions.filter(
        (ext) => !extensionsJsonIds.has(ext.id.toLowerCase()),
      );

      logger.info(`=== extensions.json 与 API 对比分析 ===`);
      if (onlyInExtensionsJson.length > 0) {
        logger.info(`仅在 extensions.json 中发现的扩展 (${onlyInExtensionsJson.length} 个):`);
        onlyInExtensionsJson.slice(0, 10).forEach((ext) => {
          logger.info(`  - ${ext.identifier.id} (版本: ${ext.version})`);
        });
        if (onlyInExtensionsJson.length > 10) {
          logger.info(`  ... 还有 ${onlyInExtensionsJson.length - 10} 个扩展`);
        }
      }

      if (onlyInApi.length > 0) {
        logger.info(`仅在 API 中发现的扩展 (${onlyInApi.length} 个):`);
        onlyInApi.slice(0, 10).forEach((ext) => {
          logger.info(`  - ${ext.id} (${ext.packageJSON.displayName || ext.packageJSON.name})`);
        });
        if (onlyInApi.length > 10) {
          logger.info(`  ... 还有 ${onlyInApi.length - 10} 个扩展`);
        }
      }

      // 比较 API 和文件系统的差异（只比较用户安装的扩展，大小写不敏感）
      const fileSystemExtensionIds = new Set(
        fileSystemExtensionData.map((item: { id: string; directory: string }) =>
          item.id.toLowerCase(),
        ),
      );

      const onlyInApiVsFileSystem = [...apiExtensionIds].filter(
        (id) => !fileSystemExtensionIds.has(id),
      );
      const onlyInFileSystem = fileSystemExtensionData.filter(
        (item: { id: string; directory: string }) => !apiExtensionIds.has(item.id.toLowerCase()),
      );

      logger.info(`=== API 与文件系统对比分析 ===`);
      if (onlyInApiVsFileSystem.length > 0) {
        logger.info(`仅在 API 中发现的扩展 (${onlyInApiVsFileSystem.length} 个):`);
        onlyInApiVsFileSystem.slice(0, 10).forEach((id) => logger.info(`  - ${id}`));
        if (onlyInApiVsFileSystem.length > 10) {
          logger.info(`  ... 还有 ${onlyInApiVsFileSystem.length - 10} 个扩展`);
        }
      }
      if (onlyInFileSystem.length > 0) {
        logger.info(`仅在文件系统中发现的扩展 (${onlyInFileSystem.length} 个):`);
        onlyInFileSystem
          .slice(0, 10)
          .forEach((item: { id: string; directory: string }) =>
            logger.info(`  - ${item.id} (目录: ${item.directory})`),
          );
        if (onlyInFileSystem.length > 10) {
          logger.info(`  ... 还有 ${onlyInFileSystem.length - 10} 个扩展`);
        }
      }

      // 获取实验性功能配置
      const syncConfig = vscode.workspace.getConfiguration('vscode-syncing');
      const syncDisabledExtensions = syncConfig.get<boolean>('syncDisabledExtensions', false);

      logger.info(`实验性功能 - 同步禁用扩展: ${syncDisabledExtensions ? '启用' : '禁用'}`);

      // 使用用户安装的扩展作为基础结果
      let extensions = userInstalledExtensions.map((ext): ExtensionInfo => {
        // 使用多种方法判断扩展是否启用
        const isInConfigDisabledList = configDisabledList.includes(ext.id);
        const isInStateDisabledList = extensionStateInfo.disabledExtensions.includes(ext.id);

        let enabled = !isInConfigDisabledList && !isInStateDisabledList;

        return {
          id: ext.id,
          name: ext.packageJSON.displayName || ext.packageJSON.name,
          version: ext.packageJSON.version,
          publisher: ext.packageJSON.publisher,
          description: ext.packageJSON.description || '',
          isActive: ext.isActive,
          enabled: enabled,
          fromExtensionsJson: false,
        };
      });

      // 实验性功能：处理禁用/不可用扩展
      if (syncDisabledExtensions) {
        logger.info('启用实验性功能：处理禁用/不可用扩展');

        // 如果 extensions.json 不存在或为空，以 API 为准
        if (extensionsJsonData.length === 0) {
          logger.info('extensions.json 不存在或为空，以 API 结果为准');
        }
        // 如果 extensions.json 中的扩展数量大于 API 获取的扩展数量
        else if (extensionsJsonData.length > userInstalledExtensions.length) {
          logger.info(
            `extensions.json 中有更多扩展 (${extensionsJsonData.length} vs ${userInstalledExtensions.length})，处理禁用/不可用扩展`,
          );

          // 找出仅在 extensions.json 中存在的扩展（禁用/不可用扩展）
          const disabledExtensions = onlyInExtensionsJson.map((ext): ExtensionInfo => {
            return {
              id: ext.identifier.id,
              name: ext.displayName || ext.identifier.id.split('.').pop() || ext.identifier.id,
              version: ext.version || '未知',
              publisher: ext.identifier.id.split('.')[0] || '未知',
              description: '来自 extensions.json 的禁用/不可用扩展',
              isActive: false,
              enabled: false, // 标记为禁用
              fromExtensionsJson: true, // 标识来源
            };
          });

          logger.info(`添加 ${disabledExtensions.length} 个来自 extensions.json 的禁用/不可用扩展`);
          extensions = extensions.concat(disabledExtensions);
        }
      } else {
        logger.info('实验性功能未启用，跳过禁用/不可用扩展的处理');
      }

      // 按扩展名排序
      extensions.sort((a, b) => a.name.localeCompare(b.name));

      const enabledCount = extensions.filter((e) => e.enabled).length;
      const disabledCount = extensions.filter((e) => !e.enabled).length;
      const fromExtensionsJsonCount = extensions.filter((e) => e.fromExtensionsJson).length;

      logger.info(`收集到 ${extensions.length} 个扩展:`);
      logger.info(`  - 启用: ${enabledCount} 个, 禁用: ${disabledCount} 个`);
      if (fromExtensionsJsonCount > 0) {
        logger.info(`  - 来自 extensions.json: ${fromExtensionsJsonCount} 个`);
      }

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

      // 读取用户设置
      const userSettings = await this.readUserSettings();
      if (userSettings) {
        settings.userRaw = userSettings;
      }

      // 读取工作区设置
      const workspaceSettings = await this.readWorkspaceSettings();
      if (workspaceSettings) {
        settings.workspaceRaw = workspaceSettings;
      }

      return settings;
    } catch (error) {
      throw ErrorHandler.createError(ErrorType.SETTINGS, '获取设置信息失败', error as Error);
    }
  }

  async getThemes(): Promise<ThemesData> {
    try {
      logger.info('开始收集主题信息');

      const config = vscode.workspace.getConfiguration();
      const colorTheme = config.get<string>('workbench.colorTheme');
      const iconTheme = config.get<string>('workbench.iconTheme');
      const productIconTheme = config.get<string>('workbench.productIconTheme');

      // 获取可用主题列表
      const themeExtensions = vscode.extensions.all.filter((ext) => {
        const contributes = ext.packageJSON.contributes;
        return (
          contributes &&
          (contributes.themes || contributes.iconThemes || contributes.productIconThemes)
        );
      });

      const available: ThemeInfo[] = themeExtensions.map((ext) => {
        const contributes = ext.packageJSON.contributes || {};
        return {
          id: ext.id,
          name: ext.packageJSON.displayName || ext.packageJSON.name,
          themes: contributes.themes || [],
          iconThemes: contributes.iconThemes || [],
          productIconThemes: contributes.productIconThemes || [],
        };
      });

      return {
        current: {
          colorTheme,
          iconTheme,
          productIconTheme,
        },
        available,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw ErrorHandler.createError(ErrorType.THEMES, '获取主题信息失败', error as Error);
    }
  }

  async getSnippets(): Promise<SnippetsData> {
    try {
      logger.info('开始收集代码片段信息');

      const snippets: Record<string, SnippetInfo> = {};

      // 读取用户代码片段
      await this.readUserSnippets(snippets);

      // 读取工作区代码片段
      await this.readWorkspaceSnippets(snippets);

      logger.info(`收集到 ${Object.keys(snippets).length} 个代码片段文件`);

      return {
        snippets,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw ErrorHandler.createError(ErrorType.SNIPPETS, '获取代码片段信息失败', error as Error);
    }
  }

  // 辅助方法
  private async getExtensionStateInfo(): Promise<{ disabledExtensions: string[] }> {
    try {
      const extensionsJsonPath = getVSCodeExtensionsStateFilePath();
      logger.info(`尝试读取扩展状态文件: ${extensionsJsonPath}`);

      if (fs.existsSync(extensionsJsonPath)) {
        const extensionsData = JSON.parse(fs.readFileSync(extensionsJsonPath, 'utf8'));
        const disabledExtensions = extensionsData.disabled || [];

        logger.info(`从扩展状态文件中发现 ${disabledExtensions.length} 个禁用的扩展`);
        return { disabledExtensions };
      } else {
        logger.info(`扩展状态文件不存在: ${extensionsJsonPath}`);
        return { disabledExtensions: [] };
      }
    } catch (error) {
      logger.warn(`读取扩展状态文件失败: ${error}`);
      return { disabledExtensions: [] };
    }
  }

  private async getExtensionsJsonData(): Promise<any[]> {
    try {
      const extensionsJsonPath = path.join(this.extensionsDirectory, 'extensions.json');
      if (fs.existsSync(extensionsJsonPath)) {
        const data = JSON.parse(fs.readFileSync(extensionsJsonPath, 'utf8'));
        return Array.isArray(data) ? data : [];
      }
      return [];
    } catch (error) {
      logger.warn(`读取 extensions.json 失败: ${error}`);
      return [];
    }
  }

  private async getExtensionDataFromFileSystem(): Promise<{ id: string; directory: string }[]> {
    try {
      if (!fs.existsSync(this.extensionsDirectory)) {
        logger.warn(`扩展目录不存在: ${this.extensionsDirectory}`);
        return [];
      }

      const items = fs.readdirSync(this.extensionsDirectory);
      const result: { id: string; directory: string }[] = [];
      const ignoredExtensions = new Set<string>(); // 用于记录已经记录过的忽略扩展

      for (const item of items) {
        const itemPath = path.join(this.extensionsDirectory, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          // 扩展目录格式通常是 publisher.name-version
          const match = item.match(/^(.+?)-(\d+\.\d+\.\d+.*)$/);
          if (match) {
            const extensionId = match[1];
            if (isExtensionIgnored(extensionId)) {
              // 只在第一次遇到被忽略的扩展时记录日志
              if (!ignoredExtensions.has(extensionId)) {
                logger.info(`跳过忽略的扩展: ${extensionId}`);
                ignoredExtensions.add(extensionId);
              }
              continue;
            }
            result.push({
              id: extensionId,
              directory: item,
            });
          }
        }
      }

      // 如果有忽略的扩展，记录总结信息
      if (ignoredExtensions.size > 0) {
        logger.info(
          `文件系统扫描完成，共忽略 ${ignoredExtensions.size} 个扩展: ${Array.from(ignoredExtensions).join(', ')}`,
        );
      }

      return result;
    } catch (error) {
      logger.warn(`读取扩展目录失败: ${error}`);
      return [];
    }
  }

  private async readUserSnippets(snippets: Record<string, SnippetInfo>): Promise<void> {
    try {
      if (!fs.existsSync(this.userSnippetsPath)) {
        return;
      }

      const files = fs.readdirSync(this.userSnippetsPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.userSnippetsPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const fileName = path.basename(file, '.json');

            snippets[fileName] = {
              content,
              ext: '.json',
            };
          } catch (error) {
            logger.warn(`读取用户代码片段文件失败: ${file}, ${error}`);
          }
        }
      }
    } catch (error) {
      logger.warn(`读取用户代码片段目录失败: ${error}`);
    }
  }

  private async readWorkspaceSnippets(snippets: Record<string, SnippetInfo>): Promise<void> {
    try {
      if (!vscode.workspace.workspaceFolders) {
        return;
      }

      for (const workspaceFolder of vscode.workspace.workspaceFolders) {
        const vscodeDir = path.join(workspaceFolder.uri.fsPath, VSCODE_FILE_NAMES.VSCODE_DIR);
        const snippetsDir = path.join(vscodeDir, VSCODE_FILE_NAMES.SNIPPETS_DIR);

        if (fs.existsSync(snippetsDir)) {
          const files = fs.readdirSync(snippetsDir);
          for (const file of files) {
            if (file.endsWith('.json')) {
              try {
                const filePath = path.join(snippetsDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const fileName = `workspace-${path.basename(file, '.json')}`;

                snippets[fileName] = {
                  content,
                  ext: '.json',
                };
              } catch (error) {
                logger.warn(`读取工作区代码片段文件失败: ${file}, ${error}`);
              }
            }
          }
        }
      }
    } catch (error) {
      logger.warn(`读取工作区代码片段失败: ${error}`);
    }
  }

  private async readUserSettings(): Promise<string | null> {
    try {
      if (fs.existsSync(this.userSettingsPath)) {
        return fs.readFileSync(this.userSettingsPath, 'utf8');
      }
      return null;
    } catch (error) {
      logger.warn(`读取用户设置失败: ${error}`);
      return null;
    }
  }

  private async readWorkspaceSettings(): Promise<string | null> {
    try {
      if (!vscode.workspace.workspaceFolders) {
        return null;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders[0];
      const settingsPath = path.join(
        workspaceFolder.uri.fsPath,
        VSCODE_FILE_NAMES.VSCODE_DIR,
        VSCODE_FILE_NAMES.USER_SETTINGS,
      );

      if (fs.existsSync(settingsPath)) {
        return fs.readFileSync(settingsPath, 'utf8');
      }
      return null;
    } catch (error) {
      logger.warn(`读取工作区设置失败: ${error}`);
      return null;
    }
  }

  private logEnvironmentInfo(): void {
    logger.info(`=== 环境信息 ===`);
    logger.info(`VSCode 发行版: ${this.vscodeEdition}`);
    logger.info(`操作系统平台: ${this.platform}`);
    logger.info(`便携模式: ${this.isPortable ? '是' : '否'}`);
    logger.info(`数据目录: ${this.dataDirectory}`);
    logger.info(`用户目录: ${this.userDirectory}`);
    logger.info(`扩展目录: ${this.extensionsDirectory}`);
    logger.info(`用户设置路径: ${this.userSettingsPath}`);
    logger.info(`用户代码片段路径: ${this.userSnippetsPath}`);
  }

  // 公共方法供其他类使用
  public getUserSettingsPath(): string {
    return this.userSettingsPath;
  }

  public getUserSnippetsPath(): string {
    return this.userSnippetsPath;
  }

  public getExtensionsDirectory(): string {
    return this.extensionsDirectory;
  }

  public getDataDirectory(): string {
    return this.dataDirectory;
  }
}
