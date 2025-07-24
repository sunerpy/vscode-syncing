import * as vscode from 'vscode';
import { API_BASE_URL } from './constants';

// ===== 常量定义 =====
const GITHUB_ACCEPT_HEADER = 'application/vnd.github.v3+json';
const CONTENT_TYPE_JSON = 'application/json';
const DEFAULT_GIST_DESCRIPTION = 'VSCode 配置同步';
const DEFAULT_COMMIT_MESSAGE = '自动同步配置';

// ===== 接口定义 =====
interface GistResponse {
  id: string;
  html_url: string;
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

interface FileDataResponse {
  sha?: string;
}

export class GitHubService {
  private readonly baseUrl = API_BASE_URL;

  async updateGist(
    token: string,
    gistId: string,
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

    const headers = this.getAuthHeaders(token, CONTENT_TYPE_JSON);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      });

      // 获取响应头信息
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      await this.handleGitHubError(response);

      const result = (await response.json()) as GistResponse;

      if (!gistId && result.id) {
        await this.saveGistIdToConfig(result.id);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  // 更新仓库文件
  async updateRepository(
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

  // 测试连接
  async testConnection(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: this.getAuthHeaders(token),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // ===== 私有辅助方法 =====

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

  private async getFileSha(token: string, fileUrl: string): Promise<string | undefined> {
    try {
      const response = await fetch(fileUrl, {
        headers: this.getAuthHeaders(token),
      });

      if (!response.ok) {
        return undefined;
      }

      const fileData = (await response.json()) as FileDataResponse;

      return typeof fileData === 'object' && fileData !== null && 'sha' in fileData
        ? (fileData.sha as string)
        : undefined;
    } catch (error) {
      console.warn('获取文件 SHA 时出错:', error);
      return undefined;
    }
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
