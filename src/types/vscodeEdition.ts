/**
 * Represents the editions of VSCode.
 */
export enum VSCodeEdition {
  /**
   * The VSCode Standard Builds.
   */
  STANDARD = 'STANDARD',

  /**
   * The VSCode Insiders.
   */
  INSIDERS = 'INSIDERS',

  /**
   * The VSCode Exploration Builds.
   */
  EXPLORATION = 'EXPLORATION',

  /**
   * The VSCode under FLOSS license, see [VSCodium](https://github.com/VSCodium/vscodium).
   */
  VSCODIUM = 'VSCODIUM',

  /**
   * The VSCode Insiders under FLOSS license, see [VSCodium](https://github.com/VSCodium/vscodium).
   */
  VSCODIUM_INSIDERS = 'VSCODIUM_INSIDERS',

  /**
   * The self-compiled version of VSCode under
   * [the default configuration](https://github.com/Microsoft/vscode/blob/master/product.json).
   */
  OSS = 'OSS',

  /**
   * The VSCode provided by [Coder](https://coder.com), which is running on a remote or self-hosted server.
   */
  CODER = 'CODER',

  /**
   * The OSS VSCode server provided by [Coder](https://coder.com), which is running on a remote or self-hosted server.
   */
  CODESERVER = 'CODESERVER',

  /**
   * Cursor AI Code Editor, see [Cursor](https://www.cursor.com/).
   */
  CURSOR = 'CURSOR',

  /**
   * WindSurf AI Code Editor, see [WindSurf](https://windsurf.com/).
   */
  WINDSURF = 'WINDSURF',

  /**
   * Trae AI Code Editor, see [Trae](https://www.trae.ai/).
   */
  TRAE = 'TRAE',

  /**
   * Trae AI Code Editor CN version, see [Trae CN](https://www.trae.com.cn/).
   */
  TRAE_CN = 'TRAE_CN',

  /**
   * Remote-SSH development environment.
   */
  REMOTE_SSH = 'REMOTE_SSH',
}

/**
 * Platform types.
 */
export enum Platform {
  WINDOWS = 'win32',
  MACINTOSH = 'darwin',
  LINUX = 'linux',
}

/**
 * VSCode environment configuration for different editions.
 */
export interface VSCodeEnvironment {
  dataDirectoryName: string;
  extensionsDirectoryName: string;
}
