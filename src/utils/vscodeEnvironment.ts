import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { VSCodeEdition, Platform, VSCodeEnvironment } from '../types/vscodeEdition';

/**
 * Common file names used by VSCode
 */
export const VSCODE_FILE_NAMES = {
  EXTENSIONS_STATE: 'extensions.json',
  USER_SETTINGS: 'settings.json',
  KEYBINDINGS: 'keybindings.json',
  SNIPPETS_DIR: 'snippets',
  VSCODE_DIR: '.vscode',
} as const;

/**
 * The builtin-environments of different VSCode editions.
 */
export const VSCODE_BUILTIN_ENVIRONMENTS: Record<VSCodeEdition, VSCodeEnvironment> = {
  [VSCodeEdition.STANDARD]: {
    dataDirectoryName: 'Code',
    extensionsDirectoryName: '.vscode',
  },
  [VSCodeEdition.INSIDERS]: {
    dataDirectoryName: 'Code - Insiders',
    extensionsDirectoryName: '.vscode-insiders',
  },
  [VSCodeEdition.EXPLORATION]: {
    dataDirectoryName: 'Code - Exploration',
    extensionsDirectoryName: '.vscode-exploration',
  },
  [VSCodeEdition.VSCODIUM]: {
    dataDirectoryName: 'VSCodium',
    extensionsDirectoryName: '.vscode-oss',
  },
  [VSCodeEdition.VSCODIUM_INSIDERS]: {
    dataDirectoryName: 'VSCodium - Insiders',
    extensionsDirectoryName: '.vscodium-insiders',
  },
  [VSCodeEdition.OSS]: {
    dataDirectoryName: 'Code - OSS',
    extensionsDirectoryName: '.vscode-oss',
  },
  [VSCodeEdition.CODER]: {
    dataDirectoryName: 'Code',
    extensionsDirectoryName: 'vscode',
  },
  [VSCodeEdition.CODESERVER]: {
    dataDirectoryName: '../.local/share/code-server',
    extensionsDirectoryName: '.local/share/code-server',
  },
  [VSCodeEdition.CURSOR]: {
    dataDirectoryName: 'Cursor',
    extensionsDirectoryName: '.cursor',
  },
  [VSCodeEdition.WINDSURF]: {
    dataDirectoryName: 'WindSurf',
    extensionsDirectoryName: '.windsurf',
  },
  [VSCodeEdition.TRAE]: {
    dataDirectoryName: 'Trae',
    extensionsDirectoryName: '.trae',
  },
  [VSCodeEdition.TRAE_CN]: {
    dataDirectoryName: 'Trae CN',
    extensionsDirectoryName: '.trae-cn',
  },
  [VSCodeEdition.REMOTE_SSH]: {
    dataDirectoryName: '.vscode-server',
    extensionsDirectoryName: '.vscode-server',
  },
};

/**
 * Gets the edition of the current running VSCode.
 */
export function getVSCodeEdition(): VSCodeEdition {
  switch (vscode.env.appName) {
    case 'Visual Studio Code':
      return VSCodeEdition.STANDARD;
    case 'Visual Studio Code - Insiders':
      return VSCodeEdition.INSIDERS;
    case 'Visual Studio Code - Exploration':
      return VSCodeEdition.EXPLORATION;
    case 'VSCodium':
      return VSCodeEdition.VSCODIUM;
    case 'VSCodium - Insiders':
      return VSCodeEdition.VSCODIUM_INSIDERS;
    case 'Code - OSS':
      return VSCodeEdition.OSS;
    case 'code-server':
      return VSCodeEdition.CODESERVER;
    case 'Cursor':
      return VSCodeEdition.CURSOR;
    case 'WindSurf':
      return VSCodeEdition.WINDSURF;
    case 'Trae':
      return VSCodeEdition.TRAE;
    case 'Trae CN':
      return VSCodeEdition.TRAE_CN;
    default:
      // Fallback detection for Remote-SSH
      if (
        process.env['VSCODE_AGENT_FOLDER'] ||
        process.env['REMOTE_SSH_EXTENSION'] ||
        vscode.extensions.getExtension('ms-vscode-remote.remote-ssh') ||
        process.env['VSCODE_SSH_HOST']
      ) {
        return VSCodeEdition.REMOTE_SSH;
      }
      // Fallback detection for code-server
      if (process.env['VSCODE_SERVER_PATH'] || process.env['CODE_SERVER_VERSION']) {
        return VSCodeEdition.CODESERVER;
      }
      // Check if it's Coder
      if (vscode.extensions.getExtension('coder.coder')) {
        return VSCodeEdition.CODER;
      }
      // Default to standard
      return VSCodeEdition.STANDARD;
  }
}

/**
 * Gets the builtin-environment of the current running VSCode.
 */
export function getVSCodeBuiltinEnvironment(): VSCodeEnvironment {
  return VSCODE_BUILTIN_ENVIRONMENTS[getVSCodeEdition()];
}

/**
 * Gets the current running platform.
 */
export function getPlatform(): Platform {
  switch (process.platform) {
    case 'linux':
      return Platform.LINUX;
    case 'darwin':
      return Platform.MACINTOSH;
    case 'win32':
      return Platform.WINDOWS;
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

/**
 * VSCode paths configuration
 */
interface VSCodePaths {
  dataDirectory: string;
  extensionsDirectory: string;
}

/**
 * Helper function to check if a path exists
 */
function pathExists(filePath: string): boolean {
  try {
    const fs = require('fs');
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Gets VSCode paths based on edition and platform
 */
function getVSCodePaths(): VSCodePaths {
  const isPortable = !!process.env.VSCODE_PORTABLE;
  const platform = getPlatform();
  const edition = getVSCodeEdition();
  const homeDir = os.homedir();

  // Portable mode
  if (isPortable) {
    const portableRoot = process.env.VSCODE_PORTABLE ?? '';
    return {
      dataDirectory: path.join(portableRoot, 'user-data'),
      extensionsDirectory: path.join(portableRoot, 'extensions'),
    };
  }

  // Remote-SSH
  if (edition === VSCodeEdition.REMOTE_SSH) {
    const serverRoot = path.join(homeDir, '.vscode-server');

    // Try to find existing data directory
    const dataCandidates = [path.join(serverRoot, 'data'), serverRoot];

    let dataDirectory = path.join(serverRoot, 'data'); // default
    for (const candidate of dataCandidates) {
      const userPath = path.join(candidate, 'User');
      if (pathExists(path.join(userPath, VSCODE_FILE_NAMES.USER_SETTINGS))) {
        dataDirectory = candidate;
        break;
      }
    }

    // Try to find existing extensions directory
    const extensionCandidates = [
      path.join(serverRoot, 'extensions'),
      path.join(serverRoot, 'data', 'extensions'),
    ];

    let extensionsDirectory = path.join(serverRoot, 'extensions'); // default
    for (const candidate of extensionCandidates) {
      if (pathExists(candidate)) {
        extensionsDirectory = candidate;
        break;
      }
    }

    return { dataDirectory, extensionsDirectory };
  }

  // Code Server
  if (edition === VSCodeEdition.CODESERVER) {
    // Try to find existing data directory
    const dataCandidates = [
      '/config/data',
      path.join(homeDir, '.local/share/code-server'),
      path.join(homeDir, '.config/code-server'),
    ];

    let dataDirectory = '/config/data'; // default
    for (const candidate of dataCandidates) {
      const userPath = path.join(candidate, 'User');
      if (pathExists(path.join(userPath, VSCODE_FILE_NAMES.USER_SETTINGS))) {
        dataDirectory = candidate;
        break;
      }
    }

    // Try to find existing extensions directory
    const extensionCandidates = [
      '/config/extensions',
      path.join(homeDir, '.local/share/code-server/extensions'),
      path.join(homeDir, '.config/code-server/extensions'),
    ];

    let extensionsDirectory = '/config/extensions'; // default
    for (const candidate of extensionCandidates) {
      if (pathExists(candidate)) {
        extensionsDirectory = candidate;
        break;
      }
    }

    return { dataDirectory, extensionsDirectory };
  }

  // Standard VSCode editions
  const { dataDirectoryName, extensionsDirectoryName } = getVSCodeBuiltinEnvironment();

  let dataDirectory: string;
  switch (platform) {
    case Platform.WINDOWS:
      dataDirectory = path.join(process.env.APPDATA ?? '', dataDirectoryName);
      break;
    case Platform.MACINTOSH:
      dataDirectory = path.join(homeDir, 'Library', 'Application Support', dataDirectoryName);
      break;
    case Platform.LINUX:
    default:
      dataDirectory = path.join(homeDir, '.config', dataDirectoryName);
      break;
  }

  const extensionsDirectory = path.join(homeDir, extensionsDirectoryName, 'extensions');

  return { dataDirectory, extensionsDirectory };
}

/**
 * Gets the data directory of VSCode.
 */
export function getVSCodeDataDirectory(): string {
  return getVSCodePaths().dataDirectory;
}

/**
 * Gets the extensions directory of VSCode.
 */
export function getVSCodeExtensionsDirectory(): string {
  return getVSCodePaths().extensionsDirectory;
}

/**
 * Gets the extensions state file path (extensions.json) for VSCode.
 * This file contains information about disabled extensions.
 */
export function getVSCodeExtensionsStateFilePath(): string {
  const extensionsDirectory = getVSCodeExtensionsDirectory();
  return path.join(extensionsDirectory, VSCODE_FILE_NAMES.EXTENSIONS_STATE);
}
