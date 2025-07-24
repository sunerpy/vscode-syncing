import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DataCollector } from './dataCollector';
import { GitHubService } from './githubService';
import { ExportMethod, ErrorMessage, DEFAULT_TIMEOUT } from './constants';
import {
  ExtensionsExport,
  SettingsExport,
  ThemesExport,
  SnippetData,
  LocalImportResult,
} from './types/types';
import { ReloadStatusBar } from './statusBar';
export class SyncManager {
  private static readonly EXPORT_TIMEOUT = DEFAULT_TIMEOUT; // 统一导出超时时间(毫秒)
  private githubService: GitHubService;
  private dataCollector: DataCollector;
  private outputChannel: vscode.OutputChannel;
  private reloadBar: ReloadStatusBar;

  constructor(reloadBar: ReloadStatusBar) {
    this.githubService = new GitHubService();
    this.outputChannel = vscode.window.createOutputChannel('vscode-syncing');
    this.dataCollector = new DataCollector(this.outputChannel);
    this.reloadBar = reloadBar;
    this.outputChannel.appendLine(`当前appName: ${vscode.env.appName}`);
    this.outputChannel.appendLine(`当前环境: ${this.dataCollector.vscodeEdition}`);
    this.outputChannel.appendLine(`用户设置路径: ${this.dataCollector.userSettingsPath}`);
    this.outputChannel.appendLine(`用户代码片段路径: ${this.dataCollector.userSnippetsPath}`);
    this.outputChannel.appendLine(`vscode.env.appRoot: ${vscode.env.appRoot}`);
    try {
      const config = vscode.workspace.getConfiguration();
      const inspectResult = config.inspect('');
      if (inspectResult) {
        this.outputChannel.appendLine(
          `vscode.workspace.getConfiguration() workspaceFolderValue: ${JSON.stringify(inspectResult.workspaceFolderValue)}`,
        );
      } else {
        this.outputChannel.appendLine(
          "vscode.workspace.getConfiguration().inspect('') 返回 undefined",
        );
      }
    } catch (e) {
      this.outputChannel.appendLine(`无法获取 workspace.getConfiguration 详细信息: ${e}`);
    }
  }

  dispose() {
    // 释放资源
    this.outputChannel.dispose();
  }

  async exportAll(): Promise<void> {
    try {
      this.outputChannel.appendLine('开始导出所有配置...');
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '正在导出所有配置...',
          cancellable: false,
        },
        async (progress) => {
          progress.report({ increment: 0, message: '导出扩展...' });
          await this.exportExtensions();
          this.outputChannel.appendLine('扩展导出完成');

          progress.report({ increment: 25, message: '导出设置...' });
          await this.exportSettings();
          this.outputChannel.appendLine('设置导出完成');

          progress.report({ increment: 50, message: '导出主题...' });
          await this.exportThemes();
          this.outputChannel.appendLine('主题导出完成');

          progress.report({ increment: 75, message: '导出代码片段...' });
          await this.exportSnippets();
          this.outputChannel.appendLine('代码片段导出完成');

          progress.report({ increment: 100, message: '所有配置导出完成!' });
          this.outputChannel.appendLine('所有配置导出完成！');
        },
      );

      const config = vscode.workspace.getConfiguration('vscode-syncing');
      const exportMethod = config.get<string>('exportMethod', ExportMethod.Local);
      let exportPath: string;

      switch (exportMethod) {
        case ExportMethod.Local:
          exportPath = config.get<string>('localPath') || path.join(os.homedir(), '.vscode-sync');
          break;
        case ExportMethod.Gist:
          const gistId = config.get<string>('gistId');
          exportPath = gistId
            ? `https://gist.github.com/${gistId}`
            : ErrorMessage.MissingGistConfig;
          break;
        case ExportMethod.Repository:
          const repoName = config.get<string>('repoName');
          const branch = config.get<string>('branch', 'main');
          exportPath = repoName
            ? `https://github.com/${repoName}/tree/${branch}`
            : ErrorMessage.MissingRepoConfig;
          break;
        default:
          exportPath = '未知导出方式';
      }

      vscode.window.showInformationMessage(`所有配置导出成功！路径: ${exportPath}`);
    } catch (error) {
      this.outputChannel.appendLine(`导出所有配置失败: ${error}`);
      vscode.window.showErrorMessage(`导出失败: ${error}`);
    }
  }

  async exportExtensions(): Promise<void> {
    try {
      this.outputChannel.appendLine('开始导出扩展...');
      const extensions = await this.dataCollector.getExtensions();
      const exportPath = await Promise.race([
        this.exportData({ extensions, timestamp: new Date().toISOString() }, 'extensions'),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(ErrorMessage.ExportTimeout)),
            SyncManager.EXPORT_TIMEOUT,
          ),
        ),
      ]);
      this.outputChannel.appendLine(`扩展列表导出成功！路径: ${exportPath}`);
      vscode.window.showInformationMessage(`扩展列表导出成功！路径: ${exportPath}`);
    } catch (error) {
      this.outputChannel.appendLine(`导出扩展失败: ${error}`);
      vscode.window.showErrorMessage(`导出扩展失败: ${error}`);
    }
  }

  async exportSettings(): Promise<void> {
    try {
      this.outputChannel.appendLine('开始导出设置...');
      const settings = await this.dataCollector.getSettings();
      const exportPath = await Promise.race([
        this.exportData({ settings, timestamp: new Date().toISOString() }, 'settings'),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(ErrorMessage.ExportTimeout)),
            SyncManager.EXPORT_TIMEOUT,
          ),
        ),
      ]);
      this.outputChannel.appendLine(`设置导出成功！路径: ${exportPath}`);
      vscode.window.showInformationMessage(`设置导出成功！路径: ${exportPath}`);
    } catch (error) {
      this.outputChannel.appendLine(`导出设置失败: ${error}`);
      vscode.window.showErrorMessage(`导出设置失败: ${error}`);
    }
  }

  async exportThemes(): Promise<void> {
    try {
      this.outputChannel.appendLine('开始导出主题...');
      const themes = await this.dataCollector.getThemes();
      const exportPath = await Promise.race([
        this.exportData({ themes, timestamp: new Date().toISOString() }, 'themes'),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(ErrorMessage.ExportTimeout)),
            SyncManager.EXPORT_TIMEOUT,
          ),
        ),
      ]);
      this.outputChannel.appendLine(`主题导出成功！路径: ${exportPath}`);
      vscode.window.showInformationMessage(`主题导出成功！路径: ${exportPath}`);
    } catch (error) {
      this.outputChannel.appendLine(`导出主题失败: ${error}`);
      vscode.window.showErrorMessage(`导出主题失败: ${error}`);
    }
  }

  async exportSnippets(): Promise<void> {
    try {
      this.outputChannel.appendLine('开始导出代码片段...');
      const snippets = await this.dataCollector.getSnippets();
      const exportPath = await Promise.race([
        this.exportData({ snippets, timestamp: new Date().toISOString() }, 'snippets'),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(ErrorMessage.ExportTimeout)),
            SyncManager.EXPORT_TIMEOUT,
          ),
        ),
      ]);
      this.outputChannel.appendLine(`代码片段导出成功！路径: ${exportPath}`);
      vscode.window.showInformationMessage(`代码片段导出成功！路径: ${exportPath}`);
    } catch (error) {
      this.outputChannel.appendLine(`导出代码片段失败: ${error}`);
      vscode.window.showErrorMessage(`导出代码片段失败: ${error}`);
    }
  }

  async importAll(): Promise<void> {
    try {
      this.outputChannel.appendLine('开始导入所有配置...');
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '正在导入所有配置...',
          cancellable: false,
        },
        async (progress) => {
          const localPath = vscode.workspace
            .getConfiguration('vscode-syncing')
            .get<string>('localPath', '');
          if (!localPath) {
            throw new Error(ErrorMessage.MissingConfig);
          }
          // 路径检查（只判断是否等于VSCode配置目录）
          const isPathEqual = (a: string, b: string) =>
            path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
          const defaultSettingsPath = this.dataCollector.userSettingsPath;
          const defaultSnippetsPath = this.dataCollector.userSnippetsPath;
          if (
            isPathEqual(localPath, defaultSettingsPath) ||
            isPathEqual(localPath, defaultSnippetsPath) ||
            isPathEqual(localPath, path.dirname(defaultSettingsPath))
          ) {
            throw new Error(ErrorMessage.InvalidPath);
          }
          // 遍历各类型子目录
          const types = ['extensions', 'settings', 'themes', 'snippets'];
          for (let i = 0; i < types.length; i++) {
            const type = types[i];
            const typeDir = path.join(localPath, type);
            this.outputChannel.appendLine(`查找导入目录: ${typeDir}`);
            if (!fs.existsSync(typeDir)) {
              this.outputChannel.appendLine(`未找到目录: ${typeDir}，跳过...`);
              continue;
            }
            try {
              const data = await this.importFromLocal(type, localPath);
              if (type === 'extensions' && 'extensions' in data) {
                progress.report({ increment: 25, message: '导入扩展...' });
                await this.applyExtensions(data.extensions);
              } else if (type === 'settings' && 'settings' in data) {
                progress.report({ increment: 25, message: '导入设置...' });
                await this.applySettings(data.settings);
              } else if (type === 'themes' && 'themes' in data) {
                progress.report({ increment: 25, message: '导入主题...' });
                await this.applyThemes(data.themes);
              } else if (type === 'snippets' && 'snippets' in data) {
                progress.report({ increment: 25, message: '导入代码片段...' });
                await this.applySnippets(data.snippets);
              }
            } catch (err) {
              this.outputChannel.appendLine(`导入${type}失败: ${err}`);
            }
          }
          progress.report({ increment: 100, message: '导入完成!' });
          this.outputChannel.appendLine('所有配置导入完成');
        },
      );
      vscode.window.showInformationMessage('所有配置导入成功！');
    } catch (error) {
      this.outputChannel.appendLine(`导入所有配置失败: ${error}`);
      vscode.window.showErrorMessage(`导入失败: ${error}`);
    }
  }

  async importExtensions(): Promise<void> {
    try {
      this.outputChannel.appendLine('开始导入扩展...');
      const data = await this.importFromLocal('extensions');
      if ('extensions' in data) {
        await this.applyExtensions(data.extensions);
        this.outputChannel.appendLine('扩展列表导入成功');
        vscode.window.showInformationMessage('扩展列表导入成功！');
      } else {
        this.outputChannel.appendLine('导入失败：无效的扩展数据');
        vscode.window.showErrorMessage('导入失败：无效的扩展数据');
      }
    } catch (error) {
      this.outputChannel.appendLine(`导入扩展失败: ${error}`);
      vscode.window.showErrorMessage(`导入扩展失败: ${error}`);
    }
  }

  async importSettings(): Promise<void> {
    try {
      this.outputChannel.appendLine('开始导入设置...');
      const data = await this.importFromLocal('settings');
      if ('settings' in data) {
        await this.applySettings(data.settings);
        this.outputChannel.appendLine('设置导入成功');
        vscode.window.showInformationMessage('设置导入成功！');
      } else {
        this.outputChannel.appendLine('导入失败：无效的设置数据');
        vscode.window.showErrorMessage('导入失败：无效的设置数据');
      }
    } catch (error) {
      this.outputChannel.appendLine(`导入设置失败: ${error}`);
      vscode.window.showErrorMessage(`导入设置失败: ${error}`);
    }
  }

  async importThemes(): Promise<void> {
    try {
      this.outputChannel.appendLine('开始导入主题...');
      const data = await this.importFromLocal('themes');
      if ('themes' in data) {
        await this.applyThemes(data.themes);
        this.outputChannel.appendLine('主题导入成功');
        vscode.window.showInformationMessage('主题导入成功！');
      } else {
        this.outputChannel.appendLine('导入失败：无效的主题数据');
        vscode.window.showErrorMessage('导入失败：无效的主题数据');
      }
    } catch (error) {
      this.outputChannel.appendLine(`导入主题失败: ${error}`);
      vscode.window.showErrorMessage(`导入主题失败: ${error}`);
    }
  }

  async importSnippets(): Promise<void> {
    try {
      this.outputChannel.appendLine('开始导入代码片段...');
      const data = await this.importFromLocal('snippets');
      if ('snippets' in data) {
        await this.applySnippets(data.snippets);
        this.outputChannel.appendLine('代码片段导入成功');
        vscode.window.showInformationMessage('代码片段导入成功！');
      } else {
        this.outputChannel.appendLine('导入失败：无效的代码片段数据');
        vscode.window.showErrorMessage('导入失败：无效的代码片段数据');
      }
    } catch (error) {
      this.outputChannel.appendLine(`导入代码片段失败: ${error}`);
      vscode.window.showErrorMessage(`导入代码片段失败: ${error}`);
    }
  }

  // 修改importFromLocal，支持传入localPath，按类型读取对应目录
  private async importFromLocal(type: string, basePath?: string): Promise<LocalImportResult> {
    const config = vscode.workspace.getConfiguration('vscode-syncing');
    const localPath = basePath || config.get<string>('localPath');
    if (!localPath) {
      throw new Error(ErrorMessage.MissingConfig);
    }
    // 路径检查（只判断是否等于VSCode配置目录）
    const isPathEqual = (a: string, b: string) =>
      path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
    const defaultSettingsPath = this.dataCollector.userSettingsPath;
    const defaultSnippetsPath = this.dataCollector.userSnippetsPath;
    if (
      isPathEqual(localPath, defaultSettingsPath) ||
      isPathEqual(localPath, defaultSnippetsPath) ||
      isPathEqual(localPath, path.dirname(defaultSettingsPath))
    ) {
      throw new Error(ErrorMessage.InvalidPath);
    }
    // 构建类型目录
    const categoryPath = path.join(localPath, type);
    this.outputChannel.appendLine(`分类文件夹路径: ${categoryPath}`);
    if (!fs.existsSync(categoryPath)) {
      this.outputChannel.appendLine(`路径不存在: ${categoryPath}`);
      throw new Error(`${ErrorMessage.InvalidPath}: ${categoryPath}`);
    }
    // 代码片段特殊处理
    if (type === 'snippets') {
      const snippets: { [key: string]: SnippetData } = {};
      const files = fs.readdirSync(categoryPath);
      for (const file of files) {
        const ext = path.extname(file);
        if (ext === '.code-snippets' || ext === '.json') {
          const fileName = path.basename(file, ext);
          const filePath = path.join(categoryPath, file);
          const content = fs.readFileSync(filePath, 'utf8');
          snippets[fileName] = { content, ext };
        }
      }
      if (Object.keys(snippets).length === 0) {
        throw new Error(`${ErrorMessage.NoSnippetsFound}: ${categoryPath}`);
      }
      return { snippets, timestamp: new Date().toISOString() };
    } else {
      // 其它类型读取固定配置文件
      // 支持 vscode-extensions.json/vscode-settings.json/vscode-themes.json
      let fileName = 'config.json';
      if (type === 'extensions') {
        fileName = 'vscode-extensions.json';
      }
      if (type === 'settings') {
        fileName = 'vscode-settings.json';
      }
      if (type === 'themes') {
        fileName = 'vscode-themes.json';
      }
      const filePath = path.join(categoryPath, fileName);
      if (!fs.existsSync(filePath)) {
        throw new Error(`${ErrorMessage.FileNotFound}: ${filePath}`);
      }
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  }

  private async applyExtensions(extensionsData: ExtensionsExport): Promise<void> {
    this.outputChannel.appendLine('应用扩展...');
    if (!extensionsData.list || !Array.isArray(extensionsData.list)) {
      this.outputChannel.appendLine('无效的扩展数据');
      throw new Error(ErrorMessage.InvalidExtensionData);
    }
    const installed = vscode.extensions.all;
    let needReload = false;
    const total = extensionsData.list.length;
    let current = 0;
    const commands = await vscode.commands.getCommands(true);
    const canEnable = commands.includes('workbench.extensions.enableExtension');
    const canDisable = commands.includes('workbench.extensions.disableExtension');
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '正在安装扩展',
        cancellable: false,
      },
      async (progress) => {
        for (const ext of extensionsData.list) {
          current++;
          const local = installed.find((e) => e.id === ext.id);
          if (local) {
            if (local.packageJSON.version !== ext.version) {
              this.outputChannel.appendLine(
                `已安装扩展 ${ext.id} 版本不符，本地:${local.packageJSON.version}，导入:${ext.version}，跳过。`,
              );
              progress.report({
                increment: (1 / total) * 100,
                message: `跳过扩展 ${current}/${total}：${ext.id}`,
              });
              continue;
            }
            // 设置启用/禁用状态
            if (ext.enabled) {
              if (canEnable) {
                await vscode.commands.executeCommand(
                  'workbench.extensions.enableExtension',
                  ext.id,
                );
                this.outputChannel.appendLine(`扩展 ${ext.id} 已启用`);
              } else {
                this.outputChannel.appendLine(
                  '当前环境不支持 enableExtension 命令，已跳过自动启用。',
                );
              }
            } else {
              if (canDisable) {
                await vscode.commands.executeCommand(
                  'workbench.extensions.disableExtension',
                  ext.id,
                );
                this.outputChannel.appendLine(`扩展 ${ext.id} 已禁用`);
              } else {
                this.outputChannel.appendLine(
                  '当前环境不支持 disableExtension 命令，已跳过自动禁用。',
                );
              }
            }
            progress.report({
              increment: (1 / total) * 100,
              message: `已存在扩展 ${current}/${total}：${ext.id}`,
            });
          } else {
            try {
              await vscode.commands.executeCommand('workbench.extensions.installExtension', ext.id);
              this.outputChannel.appendLine(`扩展 ${ext.id} 已安装`);
              // 安装新扩展后设置启用/禁用
              if (ext.enabled) {
                if (canEnable) {
                  await vscode.commands.executeCommand(
                    'workbench.extensions.enableExtension',
                    ext.id,
                  );
                  this.outputChannel.appendLine(`扩展 ${ext.id} 已启用`);
                } else {
                  this.outputChannel.appendLine(
                    '当前环境不支持 enableExtension 命令，已跳过自动启用。',
                  );
                }
              } else {
                if (canDisable) {
                  await vscode.commands.executeCommand(
                    'workbench.extensions.disableExtension',
                    ext.id,
                  );
                  this.outputChannel.appendLine(`扩展 ${ext.id} 已禁用`);
                } else {
                  this.outputChannel.appendLine(
                    '当前环境不支持 disableExtension 命令，已跳过自动禁用。',
                  );
                }
              }
              needReload = true;
              progress.report({
                increment: (1 / total) * 100,
                message: `安装扩展 ${current}/${total}：${ext.id}`,
              });
            } catch (error) {
              this.outputChannel.appendLine(`安装扩展 ${ext.id} 失败: ${error}`);
              vscode.window.showWarningMessage(`安装扩展 ${ext.id} 失败: ${error}`);
              progress.report({
                increment: (1 / total) * 100,
                message: `安装失败 ${current}/${total}：${ext.id}`,
              });
            }
          }
        }
      },
    );
    if (needReload) {
      this.outputChannel.appendLine('扩展安装完成，需要重载窗口激活扩展。');
      this.reloadBar.highlight();
      vscode.window
        .showInformationMessage('扩展安装完成，需要重载窗口激活扩展。', '立即重载')
        .then((selection) => {
          if (selection === '立即重载') {
            this.reloadBar.reset();
            vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
        });
    }
    this.outputChannel.appendLine('扩展应用完成');
  }

  private async applySettings(settingsData: SettingsExport): Promise<void> {
    this.outputChannel.appendLine('应用设置...');
    const config = vscode.workspace.getConfiguration();

    // 应用用户设置
    if (settingsData.user) {
      for (const [key, value] of Object.entries(settingsData.user)) {
        await config.update(key, value, vscode.ConfigurationTarget.Global);
        this.outputChannel.appendLine(`全局设置更新: ${key} = ${JSON.stringify(value)}`);
      }
    }

    // 应用工作区设置
    if (settingsData.workspace) {
      for (const [key, value] of Object.entries(settingsData.workspace)) {
        await config.update(key, value, vscode.ConfigurationTarget.Workspace);
        this.outputChannel.appendLine(`工作区设置更新: ${key} = ${JSON.stringify(value)}`);
      }
    }
    this.outputChannel.appendLine('设置应用完成');
  }

  private async applyThemes(themesData: ThemesExport): Promise<void> {
    this.outputChannel.appendLine('应用主题...');
    if (!themesData.current) {
      this.outputChannel.appendLine('无效的主题数据');
      throw new Error(ErrorMessage.InvalidThemeData);
    }

    const config = vscode.workspace.getConfiguration();
    if (themesData.current.colorTheme) {
      await config.update(
        'workbench.colorTheme',
        themesData.current.colorTheme,
        vscode.ConfigurationTarget.Global,
      );
      this.outputChannel.appendLine(
        `主题设置: workbench.colorTheme = ${themesData.current.colorTheme}`,
      );
    }
    if (themesData.current.iconTheme) {
      await config.update(
        'workbench.iconTheme',
        themesData.current.iconTheme,
        vscode.ConfigurationTarget.Global,
      );
      this.outputChannel.appendLine(
        `主题设置: workbench.iconTheme = ${themesData.current.iconTheme}`,
      );
    }
    if (themesData.current.productIconTheme) {
      await config.update(
        'workbench.productIconTheme',
        themesData.current.productIconTheme,
        vscode.ConfigurationTarget.Global,
      );
      this.outputChannel.appendLine(
        `主题设置: workbench.productIconTheme = ${themesData.current.productIconTheme}`,
      );
    }
    this.outputChannel.appendLine('主题应用完成');
  }

  private async applySnippets(snippetsData: { [key: string]: SnippetData }): Promise<void> {
    this.outputChannel.appendLine('应用代码片段...');
    const homeDir = os.homedir();
    let codeUserDataPath: string;

    switch (os.platform()) {
      case 'win32':
        codeUserDataPath = path.join(homeDir, 'AppData', 'Roaming', 'Code', 'User');
        break;
      case 'darwin':
        codeUserDataPath = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User');
        break;
      default: // linux
        codeUserDataPath = path.join(homeDir, '.config', 'Code', 'User');
        break;
    }
    const userSnippetsPath = path.join(codeUserDataPath, 'snippets');

    // 确保代码片段目录存在
    if (!fs.existsSync(userSnippetsPath)) {
      fs.mkdirSync(userSnippetsPath, { recursive: true });
      this.outputChannel.appendLine(`创建代码片段目录: ${userSnippetsPath}`);
    }

    for (const [language, snippet] of Object.entries(snippetsData)) {
      const { content, ext } = snippet;
      const snippetFilePath = path.join(userSnippetsPath, `${language}${ext}`);
      fs.writeFileSync(snippetFilePath, content);
      this.outputChannel.appendLine(`写入代码片段: ${snippetFilePath}`);
    }

    // 通知VSCode重新加载代码片段
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
    this.outputChannel.appendLine('代码片段应用完成，已请求窗口重载');
  }

  private async exportData(data: Record<string, unknown>, type: string): Promise<string> {
    this.outputChannel.appendLine(`开始导出类型: ${type}`);
    const config = vscode.workspace.getConfiguration('vscode-syncing');
    const exportMethod = config.get<string>('exportMethod', ExportMethod.Local);

    switch (exportMethod) {
      case ExportMethod.Local:
        return this.exportToLocal(data, type);
      case ExportMethod.Gist:
        return this.exportToGist(data, type);
      case ExportMethod.Repository:
        return this.exportToRepository(data, type);
      default:
        this.outputChannel.appendLine('不支持的导出方法');
        throw new Error(ErrorMessage.UnsupportedMethod);
    }
  }

  private async exportToLocal(data: Record<string, unknown>, type: string): Promise<string> {
    this.outputChannel.appendLine('导出到本地...');
    const config = vscode.workspace.getConfiguration('vscode-syncing');
    let localPath = config.get<string>('localPath', '');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    if (!localPath) {
      localPath = path.join(os.homedir(), '.vscode-sync');
    }

    // 校验导出路径是否为VSCode默认配置路径
    const defaultSettingsPath = this.dataCollector.getUserSettingsPath();
    const defaultSnippetsPath = this.dataCollector.getUserSnippetsPath();
    if (localPath === defaultSettingsPath || localPath === defaultSnippetsPath) {
      this.outputChannel.appendLine('导出路径为VSCode默认配置路径，非法');
      throw new Error(ErrorMessage.InvalidPath);
    }
    const categoryPath = path.join(localPath, type);
    const fileName = `vscode-${type}.json`;
    const filePath = path.join(categoryPath, fileName);

    if (!fs.existsSync(categoryPath)) {
      fs.mkdirSync(categoryPath, { recursive: true });
    }

    // 特殊处理代码片段，保留原始格式
    if (type === 'snippets' && data.snippets) {
      for (const [fileName, snippet] of Object.entries(data.snippets)) {
        const snippetObj = snippet as { content: string; ext: string };
        const snippetFilePath = path.join(categoryPath, `${fileName}${snippetObj.ext}`);
        fs.writeFileSync(snippetFilePath, snippetObj.content);
        this.outputChannel.appendLine(`导出代码片段: ${snippetFilePath}`);
      }
    } else {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      this.outputChannel.appendLine(`导出配置文件: ${filePath}`);
    }

    this.outputChannel.appendLine('本地导出完成');
    return categoryPath;
  }

  private async exportToGist(data: Record<string, unknown>, type: string): Promise<string> {
    this.outputChannel.appendLine('导出到Gist...');
    const config = vscode.workspace.getConfiguration('vscode-syncing');
    const token = config.get<string>('githubToken', '');
    const gistId = config.get<string>('gistId', '');

    if (!token || !gistId) {
      this.outputChannel.appendLine('Gist配置缺失');
      throw new Error(ErrorMessage.MissingGistConfig);
    }

    const fileName = `vscode-${type}.json`;
    const gist = await this.githubService.updateGist(
      token,
      gistId,
      fileName,
      JSON.stringify(data, null, 2),
    );
    this.outputChannel.appendLine(
      `Gist导出成功: ${gist.html_url} resp: ${JSON.stringify(gist, null, 2)}`,
    );
    return gist.html_url;
  }

  private async exportToRepository(data: Record<string, unknown>, type: string): Promise<string> {
    this.outputChannel.appendLine('导出到Repository...');
    const config = vscode.workspace.getConfiguration('vscode-syncing');
    const token = config.get<string>('githubToken', '');
    const repoName = config.get<string>('repoName', '');
    const branch = config.get<string>('branch', 'main');

    if (!token || !repoName) {
      this.outputChannel.appendLine('Repository配置缺失');
      throw new Error(ErrorMessage.MissingRepoConfig);
    }

    const fileName = `vscode-${type}.json`;
    const commitMessage = `Update ${type} configuration`;

    await this.githubService.updateRepository(
      token,
      repoName,
      branch,
      fileName,
      JSON.stringify(data, null, 2),
      commitMessage,
    );
    this.outputChannel.appendLine(
      `Repository导出成功: https://github.com/${repoName}/blob/${branch}/${fileName}`,
    );
    return `https://github.com/${repoName}/blob/${branch}/${fileName}`;
  }
}
