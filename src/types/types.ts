// 类型定义集中管理

export interface SnippetData {
  content: string;
  ext: string;
}

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  publisher: string;
  description: string;
  isActive: boolean;
  /**
   * 是否启用（true=启用，false=被禁用）
   */
  enabled: boolean;
}

export interface ExtensionsExport {
  count: number;
  list: ExtensionInfo[];
}

export interface SettingsExport {
  user?: Record<string, unknown>;
  workspace?: Record<string, unknown>;
}

export interface ThemeInfo {
  id: string;
  name: string;
  themes: unknown[];
  iconThemes: unknown[];
  productIconThemes: unknown[];
}

export interface ThemesExport {
  current: {
    colorTheme?: string;
    iconTheme?: string;
    productIconTheme?: string;
  };
  available: ThemeInfo[];
}

export type LocalImportResult =
  | { extensions: ExtensionsExport; timestamp: string }
  | { settings: SettingsExport; timestamp: string }
  | { themes: ThemesExport; timestamp: string }
  | { snippets: { [key: string]: SnippetData }; timestamp: string };
