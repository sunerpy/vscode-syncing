import * as vscode from 'vscode';
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
import { API_BASE_URL } from '../types/constants';

// GitHub API 相关常量
const GITHUB_ACCEPT_HEADER = 'application/vnd.github.v3+json';
const CONTENT_TYPE_JSON = 'application/json';
const DEFAULT_GIST_DESCRIPTION = 'VSCode 配置同步';

// 接口定义
interface GistResponse {
  id: string;
  html_url: string;
  files: Record<string, { content: string }>;
}

interface GistFile {
  content: string;
}

interface GistFiles {
  [fileName: string]: GistFile;
}

interface GistBody {
  description: string;
  files: GistFiles;
  public?: boolean;
}

export class GistExportProvider implements IExportProvider {
  private readonly baseUrl = API_BASE_URL;

  constructor(private config: SyncConfiguration) {}

  async export(data: ExportData, type: DataType): Promise<string> {
    try {
      logger.info(`Gist导出 ${type}`);

      if (!this.config.githubToken) {
        throw ErrorHandler.createError(ErrorType.CONFIGURATION, 'GitHub Token 未配置');
      }

      const fileName = this.getFileName(type);
      const content = this.prepareContent(data, type);

      const gistResponse = await this.updateGist(
        this.config.githubToken,
        this.config.gistId,
        fileName,
        content,
      );

      logger.info(`Gist导出成功: ${gistResponse.html_url}`);
      return gistResponse.html_url;
    } catch (error) {
      throw ErrorHandler.createError(ErrorType.NETWORK, `Gist导出失败: ${type}`, error as Error);
    }
  }

  async import(type: DataType): Promise<ImportData> {
    try {
      logger.info(`Gist导入 ${type}`);

      if (!this.config.githubToken) {
        throw ErrorHandler.createError(ErrorType.CONFIGURATION, 'GitHub Token 未配置');
      }

      if (!this.config.gistId) {
        throw ErrorHandler.createError(ErrorType.CONFIGURATION, 'Gist ID 未配置');
      }

      const gistData = await this.getGist(this.config.githubToken, this.config.gistId);
      const fileName = this.getFileName(type);

      if (!gistData.files[fileName]) {
        throw ErrorHandler.createError(ErrorType.FILE_SYSTEM, `Gist中未找到文件: ${fileName}`);
      }

      const content = gistData.files[fileName].content;
      return this.parseContent(content, type);
    } catch (error) {
      throw ErrorHandler.createError(ErrorType.NETWORK, `Gist导入失败: ${type}`, error as Error);
    }
  }

  async test(): Promise<boolean> {
    try {
      if (!this.config.githubToken) {
        return false;
      }

      logger.info('测试Gist连接');
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: this.getAuthHeaders(this.config.githubToken),
      });

      return response.ok;
    } catch (error) {
      logger.error('Gist导出提供者测试失败', error as Error);
      return false;
    }
  }

  private async updateGist(
    token: string,
    gistId: string | undefined,
    fileName: string,
    content: string,
  ): Promise<GistResponse> {
    const url = gistId ? `${this.baseUrl}/gists/${gistId}` : `${this.baseUrl}/gists`;
    const method = gistId ? 'PATCH' : 'POST';

    const body: GistBody = {
      description: `${DEFAULT_GIST_DESCRIPTION} - ${new Date().toLocaleString()}`,
      files: {
        [fileName]: {
          content,
        },
      },
      public: false,
    };

    const response = await fetch(url, {
      method,
      headers: this.getAuthHeaders(token, CONTENT_TYPE_JSON),
      body: JSON.stringify(body),
    });

    await this.handleGitHubError(response);
    const result = (await response.json()) as GistResponse;

    // 如果是新创建的Gist，保存ID到配置
    if (!gistId && result.id) {
      await this.saveGistIdToConfig(result.id);
    }

    return result;
  }

  private async getGist(token: string, gistId: string): Promise<GistResponse> {
    const url = `${this.baseUrl}/gists/${gistId}`;

    const response = await fetch(url, {
      headers: this.getAuthHeaders(token),
    });

    await this.handleGitHubError(response);
    return (await response.json()) as GistResponse;
  }

  private getFileName(type: DataType): string {
    return `vscode-${type}.json`;
  }

  private prepareContent(data: ExportData, type: DataType): string {
    if (type === DataType.SETTINGS && 'userRaw' in data) {
      // 对于设置数据，如果有原始内容，优先使用原始内容
      const settingsData = data as SettingsData;
      if (settingsData.userRaw) {
        return settingsData.userRaw;
      }
    }
    return JSON.stringify(data, null, 2);
  }

  private parseContent(content: string, type: DataType): ImportData {
    if (type === DataType.SETTINGS) {
      // 对于设置数据，直接返回原始内容
      return {
        userRaw: content,
        timestamp: new Date().toISOString(),
      } as SettingsData;
    }

    try {
      return JSON.parse(content) as ImportData;
    } catch (error) {
      throw ErrorHandler.createError(
        ErrorType.FILE_SYSTEM,
        `解析内容失败: ${type}`,
        error as Error,
      );
    }
  }

  private getAuthHeaders(token: string, contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `token ${token}`,
      Accept: GITHUB_ACCEPT_HEADER,
    };

    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    return headers;
  }

  private async handleGitHubError(response: Response): Promise<void> {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API 错误: ${response.status} - ${errorText}`);
    }
  }

  private async saveGistIdToConfig(gistId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('vscode-syncing');
    await config.update('gistId', gistId, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`新的 Gist 已创建，ID: ${gistId}`);
  }
}
