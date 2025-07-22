import * as vscode from 'vscode';

export class ConfigurationManager {
  async showConfigurationDialog(): Promise<void> {
    const config = vscode.workspace.getConfiguration('vscode-syncing');

    // 选择导出方式
    const exportMethod = await vscode.window.showQuickPick(
      [
        { label: '本地文件', value: 'local', description: '导出到本地指定目录' },
        { label: 'GitHub Gist', value: 'gist', description: '导出到GitHub Gist' },
        { label: 'GitHub 仓库', value: 'repository', description: '导出到GitHub仓库' },
      ],
      {
        placeHolder: '选择导出方式',
        ignoreFocusOut: true,
      },
    );

    if (!exportMethod) {
      return;
    }

    await config.update('exportMethod', exportMethod.value, vscode.ConfigurationTarget.Global);

    switch (exportMethod.value) {
      case 'local':
        await this.configureLocal();
        break;
      case 'gist':
        await this.configureGist();
        break;
      case 'repository':
        await this.configureRepository();
        break;
    }

    vscode.window.showInformationMessage('配置已保存！');
  }

  private async configureLocal(): Promise<void> {
    const result = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: '选择导出目录',
    });

    if (result && result.length > 0) {
      const config = vscode.workspace.getConfiguration('vscode-syncing');
      await config.update('localPath', result[0].fsPath, vscode.ConfigurationTarget.Global);
    }
  }

  private async configureGist(): Promise<void> {
    const config = vscode.workspace.getConfiguration('vscode-syncing');

    // 配置GitHub Token
    const token = await vscode.window.showInputBox({
      prompt: '请输入GitHub Personal Access Token',
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Token不能为空';
        }
        return null;
      },
    });

    if (!token) {
      return;
    }

    await config.update('githubToken', token, vscode.ConfigurationTarget.Global);

    // 配置Gist ID（可选）
    const gistId = await vscode.window.showInputBox({
      prompt: '请输入Gist ID（可选，留空将创建新的Gist）',
      ignoreFocusOut: true,
    });

    if (gistId) {
      await config.update('gistId', gistId, vscode.ConfigurationTarget.Global);
    }
  }

  private async configureRepository(): Promise<void> {
    const config = vscode.workspace.getConfiguration('vscode-syncing');

    // 配置GitHub Token
    const token = await vscode.window.showInputBox({
      prompt: '请输入GitHub Personal Access Token',
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Token不能为空';
        }
        return null;
      },
    });

    if (!token) {
      return;
    }

    await config.update('githubToken', token, vscode.ConfigurationTarget.Global);

    // 配置仓库名
    const repoName = await vscode.window.showInputBox({
      prompt: '请输入仓库名（格式：owner/repo）',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || !value.includes('/')) {
          return '请输入正确的仓库名格式：owner/repo';
        }
        return null;
      },
    });

    if (!repoName) {
      return;
    }

    await config.update('repositoryName', repoName, vscode.ConfigurationTarget.Global);

    // 配置分支
    const branch = await vscode.window.showInputBox({
      prompt: '请输入分支名',
      value: 'main',
      ignoreFocusOut: true,
    });

    if (branch) {
      await config.update('repositoryBranch', branch, vscode.ConfigurationTarget.Global);
    }
  }
}
