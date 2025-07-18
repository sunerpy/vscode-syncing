# vscode-syncing

English | [简体中文](./README-CN.md)

[![CI](https://github.com/sunerpy/vscode-syncing/workflows/CI/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/ci.yml)
[![PR Check](https://github.com/sunerpy/vscode-syncing/workflows/PR%20Check/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/pr-check.yml)
[![Release](https://github.com/sunerpy/vscode-syncing/workflows/Release/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/release.yml)
[![Nightly Build](https://github.com/sunerpy/vscode-syncing/workflows/Nightly%20Build/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/nightly.yml)

`vscode-syncing` is a VS Code extension for synchronizing your settings, extensions, themes, and code snippets across multiple devices. It is especially useful for remote development scenarios (such as code-server).

## ✨ Features

- Sync the following to local or remote servers:
  - User settings (`settings.json`)
  - Keybindings (`keybindings.json`)
  - Code snippets
  - Extensions list
- Support for CLI backup/restore
- Save settings to Git, S3, or other custom backends
- **Full support for Remote-SSH development environments**
- **Automatic environment detection for different VSCode editions**

## 📦 Installation

```bash
code --install-extension vscode-syncing
```

Or search for "vscode-syncing" in the VS Code marketplace.

## ⚙️ Extension Settings

| Setting                        | Description                                 | Default   |
|--------------------------------|---------------------------------------------|-----------|
| `vscode-syncing.exportMethod`  | Export method: local, gist, or repository   | `local`   |
| `vscode-syncing.localPath`     | Local export path                           | `""`      |
| `vscode-syncing.githubToken`   | GitHub access token                         | `""`      |
| `vscode-syncing.gistId`        | GitHub Gist ID                              | `""`      |
| `vscode-syncing.repositoryName`| GitHub repository name (owner/repo)         | `""`      |
| `vscode-syncing.repositoryBranch`| GitHub repository branch                  | `main`    |

## 🐞 Known Issues

- Currently does not sync extension states (enabled/disabled)
- In code-server environments, you may need to specify the user directory manually

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
- **Cursor** (AI-powered editor)
- **WindSurf** (AI-powered editor)
- **Trae** (AI-powered editor)
- **Trae CN** (Chinese version)

### Remote-SSH Support

When using Remote-SSH for development, the extension automatically detects the remote environment and uses the correct paths:

- **Data Directory**: `~/.vscode-server/data`
- **Extensions Directory**: `~/.vscode-server/extensions`
- **User Settings**: `~/.vscode-server/data/User/settings.json`

The extension will automatically adapt to the remote server's file system and sync your configurations accordingly.

## 📝 Changelog

### 0.0.4

- 🎉 Initial release
- Support for settings and extension sync

---

## 📚 References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [code-server project](https://github.com/coder/code-server)

---

**Enjoy using `vscode-syncing` and keep your dev environment consistent!** 