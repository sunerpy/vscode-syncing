import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  IExportProvider,
  DataType,
  ExportData,
  ImportData,
  SnippetsData,
  SettingsData,
} from '../core/interfaces';
import { SyncConfiguration } from '../core/configurationManager';
import { ErrorHandler, ErrorType } from '../core/errorHandler';
import { logger } from '../core/logger';

export class LocalExportProvider implements IExportProvider {
  constructor(private config: SyncConfiguration) {}

  async export(data: ExportData, type: DataType): Promise<string> {
    try {
      logger.info(`本地导出 ${type}`);

      const localPath = this.config.localPath || path.join(os.homedir(), '.vscode-sync');
      const categoryPath = path.join(localPath, type);

      // 确保目录存在
      if (!fs.existsSync(categoryPath)) {
        fs.mkdirSync(categoryPath, { recursive: true });
      }

      // 特殊处理代码片段
      if (type === DataType.SNIPPETS && 'snippets' in data) {
        const snippetsData = data as SnippetsData;
        for (const [fileName, snippet] of Object.entries(snippetsData.snippets)) {
          const snippetFilePath = path.join(categoryPath, `${fileName}${snippet.ext}`);
          fs.writeFileSync(snippetFilePath, snippet.content);
          logger.info(`导出代码片段: ${snippetFilePath}`);
        }
      } else if (type === DataType.SETTINGS && 'userRaw' in data) {
        // 特殊处理设置文件 - 保存原始内容
        const settingsData = data as SettingsData;
        if (settingsData.userRaw) {
          const userSettingsPath = path.join(categoryPath, 'settings.json');
          fs.writeFileSync(userSettingsPath, settingsData.userRaw);
          logger.info(`导出用户设置: ${userSettingsPath}`);
        }
        if (settingsData.workspaceRaw) {
          const workspaceSettingsPath = path.join(categoryPath, 'workspace-settings.json');
          fs.writeFileSync(workspaceSettingsPath, settingsData.workspaceRaw);
          logger.info(`导出工作区设置: ${workspaceSettingsPath}`);
        }
      } else {
        // 其他类型导出为JSON文件
        const fileName = `vscode-${type}.json`;
        const filePath = path.join(categoryPath, fileName);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        logger.info(`导出配置文件: ${filePath}`);
      }

      return categoryPath;
    } catch (error) {
      throw ErrorHandler.createError(
        ErrorType.FILE_SYSTEM,
        `本地导出失败: ${type}`,
        error as Error,
      );
    }
  }

  async import(type: DataType): Promise<ImportData> {
    try {
      logger.info(`本地导入 ${type}`);

      const localPath = this.config.localPath || path.join(os.homedir(), '.vscode-sync');
      const categoryPath = path.join(localPath, type);

      if (!fs.existsSync(categoryPath)) {
        throw ErrorHandler.createError(ErrorType.FILE_SYSTEM, `导入目录不存在: ${categoryPath}`);
      }

      // 特殊处理代码片段
      if (type === DataType.SNIPPETS) {
        const snippets: Record<string, any> = {};
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

        return {
          snippets,
          timestamp: new Date().toISOString(),
        } as ImportData;
      } else if (type === DataType.SETTINGS) {
        // 特殊处理设置文件 - 读取原始内容
        const settingsData: SettingsData = {
          timestamp: new Date().toISOString(),
        };

        const userSettingsPath = path.join(categoryPath, 'settings.json');
        if (fs.existsSync(userSettingsPath)) {
          settingsData.userRaw = fs.readFileSync(userSettingsPath, 'utf8');
          logger.info(`导入用户设置: ${userSettingsPath}`);
        }

        const workspaceSettingsPath = path.join(categoryPath, 'workspace-settings.json');
        if (fs.existsSync(workspaceSettingsPath)) {
          settingsData.workspaceRaw = fs.readFileSync(workspaceSettingsPath, 'utf8');
          logger.info(`导入工作区设置: ${workspaceSettingsPath}`);
        }

        return settingsData as ImportData;
      } else {
        // 其他类型从JSON文件导入
        const fileName = `vscode-${type}.json`;
        const filePath = path.join(categoryPath, fileName);

        if (!fs.existsSync(filePath)) {
          throw ErrorHandler.createError(ErrorType.FILE_SYSTEM, `导入文件不存在: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content) as ImportData;
      }
    } catch (error) {
      throw ErrorHandler.createError(
        ErrorType.FILE_SYSTEM,
        `本地导入失败: ${type}`,
        error as Error,
      );
    }
  }

  async test(): Promise<boolean> {
    try {
      const localPath = this.config.localPath || path.join(os.homedir(), '.vscode-sync');

      // 检查路径是否存在或可创建
      if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath, { recursive: true });
      }

      // 测试写入权限
      const testFile = path.join(localPath, '.test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);

      return true;
    } catch (error) {
      logger.error('本地导出提供者测试失败', error as Error);
      return false;
    }
  }
}
