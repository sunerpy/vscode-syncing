import * as vscode from 'vscode';

export const SelfExtension = 'sunerpy.vscode-syncing';

/**
 * 检查扩展是否应该被忽略
 * @param extensionId 扩展ID
 * @returns 是否应该被忽略
 */
export function isExtensionIgnored(extensionId: string): boolean {
  // 始终忽略当前扩展
  if (extensionId.toLowerCase() === SelfExtension.toLowerCase()) {
    return true;
  }

  // 获取用户配置的忽略列表
  const config = vscode.workspace.getConfiguration('vscode-syncing');
  const ignoredPatterns = config.get<string[]>('ignoredExtensions', []);

  // 检查是否匹配任何忽略模式
  for (const pattern of ignoredPatterns) {
    try {
      // 尝试作为正则表达式匹配（大小写不敏感）
      const regex = new RegExp(pattern, 'i');
      if (regex.test(extensionId)) {
        return true;
      }
    } catch (error) {
      // 如果正则表达式无效，则进行精确匹配（大小写不敏感）
      if (extensionId.toLowerCase() === pattern.toLowerCase()) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 获取所有被忽略的扩展模式（包括当前扩展）
 * @returns 忽略模式数组
 */
export function getIgnoredExtensionPatterns(): string[] {
  const config = vscode.workspace.getConfiguration('vscode-syncing');
  const userPatterns = config.get<string[]>('ignoredExtensions', []);
  return [SelfExtension, ...userPatterns];
}
export enum ExportMethod {
  Local = 'local',
  Gist = 'gist',
  Repository = 'repository',
}

export enum ErrorMessage {
  InvalidPath = '非法路径：导入/导出路径不能与VSCode默认配置路径相同',
  ExportTimeout = '导出超时',
  MissingConfig = '未配置本地同步路径，请先导出配置以设置路径',
  DirectoryNotFound = '导入目录不存在',
  NoSnippetsFound = '在指定目录中未找到任何代码片段文件',
  InvalidExtensionData = '无效的扩展数据格式',
  InvalidThemeData = '无效的主题数据格式',
  FileNotFound = '导入文件不存在',
  MissingGistConfig = 'GitHub token和Gist ID必须配置',
  MissingRepoConfig = '请配置GitHub Token和仓库名称',
  GitHubApiError = 'GitHub API 错误',
  UnsupportedMethod = '不支持的导出方式',
}

export const DEFAULT_TIMEOUT = 30000;

export const API_BASE_URL = 'https://api.github.com';
