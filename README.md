# vscode-syncing

English | [简体中文](./README-CN.md)

[![CI](https://github.com/sunerpy/vscode-syncing/workflows/CI/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/ci.yml)
[![PR Check](https://github.com/sunerpy/vscode-syncing/workflows/GitHub%20Release/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/pr-check.yml)
[![Release](https://github.com/sunerpy/vscode-syncing/workflows/Release/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/release.yml)
[![Nightly Build](https://github.com/sunerpy/vscode-syncing/workflows/Nightly%20Build/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/nightly.yml)

`vscode-syncing` is a VS Code extension for synchronizing your settings, extensions, themes, and code snippets across multiple devices. It is especially useful for remote development scenarios (such as code-server).

## ✨ Features

- **Complete Configuration Sync**: Sync the following to local or remote servers:
  - User settings (`settings.json`)
  - Keybindings (`keybindings.json`)
  - Code snippets
  - Extensions list with version control
  - Themes and color schemes
- **Advanced Extension Management**:
  - Dual installation strategy (manual + API fallback)
  - Automatic extension auto-update disabling
  - Smart version comparison and conflict resolution
  - Support for disabled/unavailable extensions (experimental)
- **Flexible Export Options**:
  - Local file system export
  - GitHub Gist integration
  - GitHub repository integration
- **Intelligent Extension Filtering**:
  - User-configurable ignore patterns with regex support
  - Automatic current extension exclusion
  - Smart duplicate detection and logging optimization
- **Multi-Environment Support**:
  - **Full support for Remote-SSH development environments**
  - **Automatic environment detection for different VSCode editions**
  - Cross-platform compatibility (Windows, macOS, Linux)

## 📦 Installation

```bash
code --install-extension vscode-syncing
```

Or search for "vscode-syncing" in the VS Code marketplace.

## 🚀 Quick Start

1. **Configure Export Method**: Choose your preferred sync method in settings
2. **Set Up Credentials**: Configure GitHub token for Gist/Repository sync (if needed)
3. **Export Configuration**: Use `Ctrl+Shift+P` → "Export All Configurations"
4. **Import on Other Devices**: Use `Ctrl+Shift+P` → "Import All Configurations"

## ⚙️ Extension Settings

### Basic Settings

| Setting                        | Description                                 | Default   |
|--------------------------------|---------------------------------------------|-----------|
| `vscode-syncing.exportMethod`  | Export method: local, gist, or repository   | `local`   |
| `vscode-syncing.localPath`     | Local export path                           | `""`      |
| `vscode-syncing.githubToken`   | GitHub access token                         | `""`      |
| `vscode-syncing.gistId`        | GitHub Gist ID                              | `""`      |
| `vscode-syncing.repositoryName`| GitHub repository name (owner/repo)         | `""`      |
| `vscode-syncing.repositoryBranch`| GitHub repository branch                  | `main`    |

### Advanced Settings

| Setting                                    | Description                                           | Default   |
|--------------------------------------------|-------------------------------------------------------|-----------|
| `vscode-syncing.syncDisabledExtensions`    | **Experimental**: Sync disabled/unavailable extensions | `false`   |
| `vscode-syncing.ignoredExtensions`         | Extensions to ignore during sync (supports regex)    | `[]`      |

### Extension Ignore Patterns

The `ignoredExtensions` setting supports both exact matches and regular expressions:

```json
{
  "vscode-syncing.ignoredExtensions": [
    "ms-vscode.*",           // Ignore all Microsoft extensions
    ".*\\.theme",            // Ignore all theme extensions
    "github.copilot",        // Ignore specific extension
    ".*debug.*",             // Ignore extensions containing "debug"
    "specific-extension-id"  // Exact match
  ]
}
```

**Features**:
- 🔍 **Regex Support**: Use regular expressions for flexible pattern matching
- 🛡️ **Auto Protection**: Current extension is automatically ignored
- 📝 **Flexible Configuration**: Mix exact matches and regex patterns
- 🚫 **Case Insensitive**: All matching is case-insensitive
- ⚠️ **Error Tolerant**: Invalid regex patterns fall back to exact matching

## 🔧 Commands

Access these commands via `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS):

### Import Commands
- `Import All Configurations` - Import all settings, extensions, themes, and snippets
- `Import Extensions List` - Import only extensions
- `Import Settings` - Import only user settings
- `Import Themes` - Import only themes and color schemes
- `Import Snippets` - Import only code snippets

### Export Commands
- `Export All Configurations` - Export all configurations
- `Export Extensions List` - Export only extensions
- `Export Settings` - Export only user settings
- `Export Themes` - Export only themes and color schemes
- `Export Snippets` - Export only code snippets

### Configuration
- `Configure Export Options` - Set up export method and credentials

## 🔧 Supported VSCode Editions

This extension automatically detects and supports the following VSCode editions:

- **Visual Studio Code** (Standard)
- **Visual Studio Code Insiders**
- **Visual Studio Code Exploration**
- **VSCodium** (Open Source)
- **VSCodium Insiders**
- **Code - OSS**
- **code-server** (Remote development)
- **Remote-SSH** (Remote development via SSH)

### Remote-SSH Support

When using Remote-SSH for development, the extension automatically detects the remote environment and uses the correct paths:

- **Data Directory**: `~/.vscode-server/data`
- **Extensions Directory**: `~/.vscode-server/extensions`
- **User Settings**: `~/.vscode-server/data/User/settings.json`

The extension will automatically adapt to the remote server's file system and sync your configurations accordingly.

## �️ Advanced Features

### Extension Management

**Dual Installation Strategy**:
1. **Primary**: Download and install specific extension versions manually
2. **Fallback**: Use VSCode API to install latest version if manual installation fails

**Auto-Update Protection**:
- Automatically adds installed extensions to VSCode's auto-update ignore list
- Prevents unwanted version changes after sync
- Maintains version consistency across devices

**Smart Conflict Resolution**:
- Compares local vs remote extension versions
- Prompts user for version update decisions
- Handles version mismatches intelligently

### Experimental Features

**Disabled Extensions Sync** (`syncDisabledExtensions`):
- Detects extensions from `extensions.json` that are not active in VSCode API
- Attempts to install and maintain disabled state
- Useful for complete environment replication

**Benefits**:
- Complete extension environment sync
- Maintains disabled extension states
- Recovers from extension installation issues

**Considerations**:
- May increase sync time
- Experimental feature, use with caution
- Best for users who need complete environment consistency

## 🐞 Known Issues

- Extension state changes (enable/disable) require manual intervention after import
- In code-server environments, you may need to specify the user directory manually
- Experimental disabled extensions sync may have compatibility issues with some extensions

## 🔍 Troubleshooting

### Common Issues

## 📝 ChangeLog

- [Changelog](./CHANGELOG.md)

---

## 📚 References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [code-server project](https://github.com/coder/code-server)

---

**Enjoy using `vscode-syncing` and keep your dev environment consistent!** 