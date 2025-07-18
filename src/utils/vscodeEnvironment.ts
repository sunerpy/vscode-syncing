import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { VSCodeEdition, Platform, VSCodeEnvironment } from '../types/vscodeEdition';

/**
 * The builtin-environments of different VSCode editions.
 */
export const VSCODE_BUILTIN_ENVIRONMENTS: Record<VSCodeEdition, VSCodeEnvironment> = {
    [VSCodeEdition.STANDARD]: {
        dataDirectoryName: "Code",
        extensionsDirectoryName: ".vscode"
    },
    [VSCodeEdition.INSIDERS]: {
        dataDirectoryName: "Code - Insiders",
        extensionsDirectoryName: ".vscode-insiders"
    },
    [VSCodeEdition.EXPLORATION]: {
        dataDirectoryName: "Code - Exploration",
        extensionsDirectoryName: ".vscode-exploration"
    },
    [VSCodeEdition.VSCODIUM]: {
        dataDirectoryName: "VSCodium",
        extensionsDirectoryName: ".vscode-oss"
    },
    [VSCodeEdition.VSCODIUM_INSIDERS]: {
        dataDirectoryName: "VSCodium - Insiders",
        extensionsDirectoryName: ".vscodium-insiders"
    },
    [VSCodeEdition.OSS]: {
        dataDirectoryName: "Code - OSS",
        extensionsDirectoryName: ".vscode-oss"
    },
    [VSCodeEdition.CODER]: {
        dataDirectoryName: "Code",
        extensionsDirectoryName: "vscode"
    },
    [VSCodeEdition.CODESERVER]: {
        dataDirectoryName: "../.local/share/code-server",
        extensionsDirectoryName: ".local/share/code-server"
    },
    [VSCodeEdition.CURSOR]: {
        dataDirectoryName: "Cursor",
        extensionsDirectoryName: ".cursor"
    },
    [VSCodeEdition.WINDSURF]: {
        dataDirectoryName: "WindSurf",
        extensionsDirectoryName: ".windsurf"
    },
    [VSCodeEdition.TRAE]: {
        dataDirectoryName: "Trae",
        extensionsDirectoryName: ".trae"
    },
    [VSCodeEdition.TRAE_CN]: {
        dataDirectoryName: "Trae CN",
        extensionsDirectoryName: ".trae-cn"
    },
    [VSCodeEdition.REMOTE_SSH]: {
        dataDirectoryName: ".vscode-server",
        extensionsDirectoryName: ".vscode-server"
    }
};

/**
 * Gets the edition of the current running VSCode.
 */
export function getVSCodeEdition(): VSCodeEdition {
    switch (vscode.env.appName) {
        case "Visual Studio Code":
            return VSCodeEdition.STANDARD;
        case "Visual Studio Code - Insiders":
            return VSCodeEdition.INSIDERS;
        case "Visual Studio Code - Exploration":
            return VSCodeEdition.EXPLORATION;
        case "VSCodium":
            return VSCodeEdition.VSCODIUM;
        case "VSCodium - Insiders":
            return VSCodeEdition.VSCODIUM_INSIDERS;
        case "Code - OSS":
            return VSCodeEdition.OSS;
        case "code-server":
            return VSCodeEdition.CODESERVER;
        case "Cursor":
            return VSCodeEdition.CURSOR;
        case "WindSurf":
            return VSCodeEdition.WINDSURF;
        case "Trae":
            return VSCodeEdition.TRAE;
        case "Trae CN":
            return VSCodeEdition.TRAE_CN;
        default:
            // Fallback detection for Remote-SSH
            if (process.env['VSCODE_AGENT_FOLDER'] || 
                process.env['REMOTE_SSH_EXTENSION'] ||
                vscode.extensions.getExtension("ms-vscode-remote.remote-ssh") ||
                process.env['VSCODE_SSH_HOST']) {
                return VSCodeEdition.REMOTE_SSH;
            }
            // Fallback detection for code-server
            if (process.env['VSCODE_SERVER_PATH'] || process.env['CODE_SERVER_VERSION']) {
                return VSCodeEdition.CODESERVER;
            }
            // Check if it's Coder
            if (vscode.extensions.getExtension("coder.coder")) {
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
        case "linux":
            return Platform.LINUX;
        case "darwin":
            return Platform.MACINTOSH;
        case "win32":
            return Platform.WINDOWS;
        default:
            throw new Error(`Unsupported platform: ${process.platform}`);
    }
}

/**
 * Gets the data directory of VSCode.
 */
export function getVSCodeDataDirectory(): string {
    const isPortable = process.env.VSCODE_PORTABLE !== null;
    const platform = getPlatform();
    const edition = getVSCodeEdition();
    
    if (isPortable) {
        return path.join(process.env.VSCODE_PORTABLE ?? "", "user-data");
    }
    
    // Special handling for Remote-SSH
    if (edition === VSCodeEdition.REMOTE_SSH) {
        const remoteSSHPaths = [
            path.join(os.homedir(), '.vscode-server', 'data', 'User'),
            path.join(os.homedir(), '.vscode-server', 'User')
        ];
        
        for (const sshPath of remoteSSHPaths) {
            try {
                const fs = require('fs');
                if (fs.existsSync(path.join(sshPath, 'settings.json'))) {
                    return path.dirname(sshPath);
                }
            } catch {}
        }
        
        // Default Remote-SSH path
        return path.join(os.homedir(), '.vscode-server', 'data');
    }
    
    // Special handling for code-server
    if (edition === VSCodeEdition.CODESERVER) {
        // Check for common code-server paths
        const codeServerPaths = [
            '/config/data/User',
            path.join(os.homedir(), '.local/share/code-server/User'),
            path.join(os.homedir(), '.config/code-server/User')
        ];
        
        for (const serverPath of codeServerPaths) {
            try {
                const fs = require('fs');
                if (fs.existsSync(path.join(serverPath, 'settings.json'))) {
                    return path.dirname(serverPath);
                }
            } catch {}
        }
        
        // Default code-server path
        return '/config/data';
    }
    
    const { dataDirectoryName } = getVSCodeBuiltinEnvironment();
    
    switch (platform) {
        case Platform.WINDOWS:
            return path.join(process.env.APPDATA ?? "", dataDirectoryName);
        case Platform.MACINTOSH:
            return path.join(
                os.homedir(),
                "Library",
                "Application Support",
                dataDirectoryName
            );
        case Platform.LINUX:
        default:
            return path.join(
                os.homedir(),
                ".config",
                dataDirectoryName
            );
    }
}

/**
 * Gets the extensions directory of VSCode.
 */
export function getVSCodeExtensionsDirectory(): string {
    const isPortable = process.env.VSCODE_PORTABLE !== null;
    const edition = getVSCodeEdition();
    
    if (isPortable) {
        return path.join(process.env.VSCODE_PORTABLE ?? "", "extensions");
    }
    
    // Special handling for Remote-SSH
    if (edition === VSCodeEdition.REMOTE_SSH) {
        const remoteSSHExtPaths = [
            path.join(os.homedir(), '.vscode-server', 'extensions'),
            path.join(os.homedir(), '.vscode-server', 'data', 'extensions')
        ];
        
        for (const extPath of remoteSSHExtPaths) {
            try {
                const fs = require('fs');
                if (fs.existsSync(extPath)) {
                    return extPath;
                }
            } catch {}
        }
        
        // Default Remote-SSH extensions path
        return path.join(os.homedir(), '.vscode-server', 'extensions');
    }
    
    // Special handling for code-server
    if (edition === VSCodeEdition.CODESERVER) {
        const codeServerExtPaths = [
            '/config/extensions',
            path.join(os.homedir(), '.local/share/code-server/extensions'),
            path.join(os.homedir(), '.config/code-server/extensions')
        ];
        
        for (const extPath of codeServerExtPaths) {
            try {
                const fs = require('fs');
                if (fs.existsSync(extPath)) {
                    return extPath;
                }
            } catch {}
        }
        
        return '/config/extensions';
    }
    
    const { extensionsDirectoryName } = getVSCodeBuiltinEnvironment();
    return path.join(os.homedir(), extensionsDirectoryName, "extensions");
} 