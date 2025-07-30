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
