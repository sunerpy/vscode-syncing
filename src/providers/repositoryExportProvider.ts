import {
  IExportProvider,
  DataType,
  ExportData,
  ImportData,
  SettingsData,
} from '../core/interfaces';
import { SyncConfiguration } from '../core/configurationManager';
import { ErrorHandler, ErrorType } from '../core/errorHandler';
import { logger } from '../core/logger';
import { API_BASE_URL } from '../types/constants';

// GitHub API 相关常量
const GITHUB_ACCEPT_HEADER = 'application/vnd.github.v3+json';
const CONTENT_TYPE_JSON = 'application/json';
const DEFAULT_COMMIT_MESSAGE = '自动同步配置';

// 接口定义
interface FileDataResponse {
  sha?: string;
  content?: string;
}

export class RepositoryExportProvider implements IExportProvider {
  private readonly baseUrl = API_BASE_URL;

  constructor(private config: SyncConfiguration) {}

  async export(data: ExportData, type: DataType): Promise<string> {
    try {
      logger.info(`Repository导出 ${type}`);

      if (!this.config.githubToken) {
        throw ErrorHandler.createError(ErrorType.CONFIGURATION, 'GitHub Token 未配置');
      }

      if (!this.config.repositoryName) {
        throw ErrorHandler.createError(ErrorType.CONFIGURATION, '仓库名称未配置');
      }

      const fileName = this.getFileName(type);
      const content = this.prepareContent(data, type);
      const branch = this.config.repositoryBranch || 'main';

      await this.updateRepository(
        this.config.githubToken,
        this.config.repositoryName,
        branch,
        fileName,
        content,
        `${DEFAULT_COMMIT_MESSAGE}: ${type}`,
      );

      const fileUrl = `https://github.com/${this.config.repositoryName}/blob/${branch}/${fileName}`;
      logger.info(`Repository导出成功: ${fileUrl}`);
      return fileUrl;
    } catch (error) {
      throw ErrorHandler.createError(
        ErrorType.NETWORK,
        `Repository导出失败: ${type}`,
        error as Error,
      );
    }
  }

  async import(type: DataType): Promise<ImportData> {
    try {
      logger.info(`Repository导入 ${type}`);

      if (!this.config.githubToken) {
        throw ErrorHandler.createError(ErrorType.CONFIGURATION, 'GitHub Token 未配置');
      }

      if (!this.config.repositoryName) {
        throw ErrorHandler.createError(ErrorType.CONFIGURATION, '仓库名称未配置');
      }

      const fileName = this.getFileName(type);
      const branch = this.config.repositoryBranch || 'main';

      const fileContent = await this.getRepositoryFile(
        this.config.githubToken,
        this.config.repositoryName,
        branch,
        fileName,
      );

      return this.parseContent(fileContent, type);
    } catch (error) {
      throw ErrorHandler.createError(
        ErrorType.NETWORK,
        `Repository导入失败: ${type}`,
        error as Error,
      );
    }
  }

  async test(): Promise<boolean> {
    try {
      if (!this.config.githubToken) {
        return false;
      }

      logger.info('测试Repository连接');
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: this.getAuthHeaders(this.config.githubToken),
      });

      return response.ok;
    } catch (error) {
      logger.error('Repository导出提供者测试失败', error as Error);
      return false;
    }
  }

  private async updateRepository(
    token: string,
    repoName: string,
    branch: string,
    fileName: string,
    content: string,
    commitMessage: string = DEFAULT_COMMIT_MESSAGE,
  ): Promise<void> {
    const fileUrl = `${this.baseUrl}/repos/${repoName}/contents/${fileName}?ref=${branch}`;
    const sha = await this.getFileSha(token, fileUrl);

    const updateUrl = `${this.baseUrl}/repos/${repoName}/contents/${fileName}`;
    const body = {
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      branch,
      ...(sha && { sha }),
    };

    const response = await fetch(updateUrl, {
      method: 'PUT',
      headers: this.getAuthHeaders(token, CONTENT_TYPE_JSON),
      body: JSON.stringify(body),
    });

    await this.handleGitHubError(response);
  }

  private async getRepositoryFile(
    token: string,
    repoName: string,
    branch: string,
    fileName: string,
  ): Promise<string> {
    const fileUrl = `${this.baseUrl}/repos/${repoName}/contents/${fileName}?ref=${branch}`;

    const response = await fetch(fileUrl, {
      headers: this.getAuthHeaders(token),
    });

    await this.handleGitHubError(response);
    const fileData = (await response.json()) as FileDataResponse;

    if (!fileData.content) {
      throw ErrorHandler.createError(ErrorType.FILE_SYSTEM, `仓库中未找到文件: ${fileName}`);
    }

    // GitHub API 返回的内容是 base64 编码的
    return Buffer.from(fileData.content, 'base64').toString('utf8');
  }

  private async getFileSha(token: string, fileUrl: string): Promise<string | undefined> {
    try {
      const response = await fetch(fileUrl, {
        headers: this.getAuthHeaders(token),
      });

      if (!response.ok) {
        return undefined;
      }

      const fileData = (await response.json()) as FileDataResponse;
      return fileData.sha;
    } catch (error) {
      logger.warn(`获取文件 SHA 时出错: ${error}`);
      return undefined;
    }
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
}
