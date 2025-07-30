/**
 * 核心接口定义
 */

export interface IDataProvider {
  getExtensions(): Promise<ExtensionsData>;
  getSettings(): Promise<SettingsData>;
  getThemes(): Promise<ThemesData>;
  getSnippets(): Promise<SnippetsData>;
}

export interface IExportProvider {
  export(data: ExportData, type: DataType): Promise<string>;
  import(type: DataType): Promise<ImportData>;
  test(): Promise<boolean>;
}

export interface IConfigurationProvider {
  get<T>(key: string, defaultValue?: T): T;
  update(key: string, value: any): Promise<void>;
  validate(): Promise<ValidationResult>;
  getConfiguration(): any;
}

export interface IProgressReporter {
  report(progress: ProgressInfo): void;
}

export interface ILogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string, error?: Error): void;
  debug(message: string): void;
}

// 数据类型定义
export enum DataType {
  EXTENSIONS = 'extensions',
  SETTINGS = 'settings',
  THEMES = 'themes',
  SNIPPETS = 'snippets',
}

export interface ExtensionsData {
  count: number;
  list: ExtensionInfo[];
  timestamp: string;
}

export interface SettingsData {
  user?: Record<string, any>;
  workspace?: Record<string, any>;
  userRaw?: string;
  workspaceRaw?: string;
  timestamp: string;
}

export interface ThemesData {
  current: {
    colorTheme?: string;
    iconTheme?: string;
    productIconTheme?: string;
  };
  available: ThemeInfo[];
  timestamp: string;
}

export interface SnippetsData {
  snippets: Record<string, SnippetInfo>;
  timestamp: string;
}

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  publisher: string;
  description: string;
  isActive: boolean;
  enabled: boolean;
  fromExtensionsJson?: boolean; // 标识是否来自 extensions.json（禁用/不可用扩展）
  vsixFilepath?: string; // VSIX文件路径（用于安装过程）
}

export interface ThemeInfo {
  id: string;
  name: string;
  themes: unknown[];
  iconThemes: unknown[];
  productIconThemes: unknown[];
}

export interface SnippetInfo {
  content: string;
  ext: string;
}

export type ExportData = ExtensionsData | SettingsData | ThemesData | SnippetsData;
export type ImportData = ExtensionsData | SettingsData | ThemesData | SnippetsData;

export interface ProgressInfo {
  increment: number;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
