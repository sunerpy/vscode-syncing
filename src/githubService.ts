import * as vscode from 'vscode';
import { API_BASE_URL } from './constants';

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

export class GitHubService {
    private readonly baseUrl = API_BASE_URL;

    async updateGist(token: string, gistId: string, fileName: string, content: string): Promise<GistResponse> {
        const url = gistId ? `${this.baseUrl}/gists/${gistId}` : `${this.baseUrl}/gists`;
        const method = gistId ? 'PATCH' : 'POST';

        const body: GistBody = {
            description: `VSCode 配置同步 - ${new Date().toLocaleString()}`,
            files: {
                [fileName]: {
                    content: content
                }
            }
        };

        if (!gistId) {
            body.public = false;
        }

        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`GitHub API 错误: ${response.status} - ${error}`);
        }

        const result = await response.json() as GistResponse;

        // 如果是新创建的Gist，保存ID
        if (!gistId && result.id) {
            const config = vscode.workspace.getConfiguration('vscode-syncing');
            await config.update('gistId', result.id, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`新的Gist已创建，ID: ${result.id}`);
        }
        return result;
    }

    async updateRepository(
        token: string,
        repoName: string,
        branch: string,
        fileName: string,
        content: string,
        commitMessage: string
    ): Promise<void> {
        try {
            // 获取文件的当前SHA（如果存在）
            const fileUrl = `${this.baseUrl}/repos/${repoName}/contents/${fileName}?ref=${branch}`;
            let sha: string | undefined;

            try {
                const fileResponse = await fetch(fileUrl, {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (fileResponse.ok) {
                    const fileData = await fileResponse.json();
                    if (typeof fileData === 'object' && fileData !== null && 'sha' in fileData && typeof fileData.sha === 'string') {
                        sha = fileData.sha;
                    }
                }
            } catch (error) {
                // 文件不存在，这是正常的
            }

            // 更新或创建文件
            interface RepoUpdateBody {
                message: string;
                content: string;
                branch: string;
                sha?: string;
            }
            const updateUrl = `${this.baseUrl}/repos/${repoName}/contents/${fileName}`;
            const body: RepoUpdateBody = {
                message: commitMessage,
                content: Buffer.from(content).toString('base64'),
                branch: branch
            };

            if (sha) {
                body.sha = sha;
            }

            const response = await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`GitHub API 错误: ${response.status} - ${error}`);
            }

        } catch (error) {
            throw new Error(`更新仓库失败: ${error}`);
        }
    }

    async testConnection(token: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/user`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            return response.ok;
        } catch (error) {
            return false;
        }
    }
}