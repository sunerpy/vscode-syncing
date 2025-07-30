import * as vscode from 'vscode';
import { IConfigurationProvider, ValidationResult } from './interfaces';
import { ErrorHandler, ErrorType } from './errorHandler';
import { logger } from './logger';

export enum ExportMethod {
  LOCAL = 'local',
  GIST = 'gist',
  REPOSITORY = 'repository',
}

export interface SyncConfiguration {
  exportMethod: ExportMethod;
  localPath?: string;
  githubToken?: string;
  gistId?: string;
  repositoryName?: string;
  repositoryBranch?: string;
}

export class ConfigurationManager implements IConfigurationProvider {
  private readonly configSection = 'vscode-syncing';

  get<T>(key: string, defaultValue?: T): T {
    const config = vscode.workspace.getConfiguration(this.configSection);
    return config.get<T>(key, defaultValue as T);
  }

  async update(key: string, value: any): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration(this.configSection);
      await config.update(key, value, vscode.ConfigurationTarget.Global);
      logger.info(`配置已更新: ${key} = ${JSON.stringify(value)}`);
    } catch (error) {
      throw ErrorHandler.createError(
        ErrorType.CONFIGURATION,
        `更新配置失败: ${key}`,
        error as Error,
      );
    }
  }

  async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    const config = this.getConfiguration();

    // 验证导出方式
    if (!Object.values(ExportMethod).includes(config.exportMethod)) {
      errors.push('无效的导出方式');
    }

    // 根据导出方式验证相应配置
    switch (config.exportMethod) {
      case ExportMethod.LOCAL:
        if (!config.localPath) {
          errors.push('本地导出路径未配置');
        }
        break;
      case ExportMethod.GIST:
        if (!config.githubToken) {
          errors.push('GitHub Token未配置');
        }
        break;
      case ExportMethod.REPOSITORY:
        if (!config.githubToken) {
          errors.push('GitHub Token未配置');
        }
        if (!config.repositoryName) {
          errors.push('仓库名称未配置');
        } else if (!this.isValidRepositoryName(config.repositoryName)) {
          errors.push('仓库名称格式无效，应为 owner/repo 格式');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  getConfiguration(): SyncConfiguration {
    return {
      exportMethod: this.get<ExportMethod>('exportMethod', ExportMethod.LOCAL),
      localPath: this.get<string>('localPath'),
      githubToken: this.get<string>('githubToken'),
      gistId: this.get<string>('gistId'),
      repositoryName: this.get<string>('repositoryName'),
      repositoryBranch: this.get<string>('repositoryBranch', 'main'),
    };
  }

  async showConfigurationWizard(): Promise<boolean> {
    try {
      // 选择导出方式
      const exportMethod = await this.selectExportMethod();
      if (!exportMethod) {
        return false;
      }

      await this.update('exportMethod', exportMethod);

      // 根据选择的方式配置相应参数
      let configured = false;
      switch (exportMethod) {
        case ExportMethod.LOCAL:
          configured = await this.configureLocal();
          break;
        case ExportMethod.GIST:
          configured = await this.configureGist();
          break;
        case ExportMethod.REPOSITORY:
          configured = await this.configureRepository();
          break;
      }

      if (configured) {
        vscode.window.showInformationMessage('配置已保存！');
        return true;
      }

      return false;
    } catch (error) {
      ErrorHandler.handle(error as Error, 'ConfigurationWizard');
      return false;
    }
  }

  private isValidRepositoryName(repoName: string): boolean {
    return /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repoName);
  }

  private async selectExportMethod(): Promise<ExportMethod | undefined> {
    const options = [
      {
        label: '$(folder) 本地文件',
        description: '导出到本地指定目录',
        value: ExportMethod.LOCAL,
      },
      {
        label: '$(github) GitHub Gist',
        description: '导出到GitHub Gist',
        value: ExportMethod.GIST,
      },
      {
        label: '$(repo) GitHub 仓库',
        description: '导出到GitHub仓库',
        value: ExportMethod.REPOSITORY,
      },
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: '选择导出方式',
      ignoreFocusOut: true,
    });

    return selected?.value;
  }

  private async configureLocal(): Promise<boolean> {
    const result = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: '选择导出目录',
    });

    if (result && result.length > 0) {
      await this.update('localPath', result[0].fsPath);
      return true;
    }

    return false;
  }

  private async configureGist(): Promise<boolean> {
    // 配置GitHub Token
    const token = await vscode.window.showInputBox({
      prompt: '请输入GitHub Personal Access Token',
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Token不能为空';
        }
        if (value.length < 40) {
          return 'Token长度不正确';
        }
        return null;
      },
    });

    if (!token) {
      return false;
    }

    await this.update('githubToken', token);

    // 配置Gist ID（可选）
    const gistId = await vscode.window.showInputBox({
      prompt: '请输入Gist ID（可选，留空将创建新的Gist）',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (value && !/^[a-f0-9]{32}$/.test(value)) {
          return 'Gist ID格式不正确';
        }
        return null;
      },
    });

    if (gistId) {
      await this.update('gistId', gistId);
    }

    return true;
  }

  private async configureRepository(): Promise<boolean> {
    // 配置GitHub Token
    const token = await vscode.window.showInputBox({
      prompt: '请输入GitHub Personal Access Token',
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Token不能为空';
        }
        if (value.length < 40) {
          return 'Token长度不正确';
        }
        return null;
      },
    });

    if (!token) {
      return false;
    }

    await this.update('githubToken', token);

    // 配置仓库名
    const repoName = await vscode.window.showInputBox({
      prompt: '请输入仓库名（格式：owner/repo）',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || !value.includes('/')) {
          return '请输入正确的仓库名格式：owner/repo';
        }
        if (!this.isValidRepositoryName(value)) {
          return '仓库名格式不正确';
        }
        return null;
      },
    });

    if (!repoName) {
      return false;
    }

    await this.update('repositoryName', repoName);

    // 配置分支
    const branch = await vscode.window.showInputBox({
      prompt: '请输入分支名',
      value: 'main',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return '分支名不能为空';
        }
        return null;
      },
    });

    if (branch) {
      await this.update('repositoryBranch', branch);
    }

    return true;
  }
}
