# vscode-syncing

[English](./README.md) | 简体中文


[![CI](https://github.com/sunerpy/vscode-syncing/workflows/CI/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/ci.yml)
[![PR Check](https://github.com/sunerpy/vscode-syncing/workflows/PR%20Check/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/pr-check.yml)
[![Release](https://github.com/sunerpy/vscode-syncing/workflows/GitHub%20Release/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/release.yml)
[![Nightly Build](https://github.com/sunerpy/vscode-syncing/workflows/Nightly%20Build/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/nightly.yml)

`vscode-syncing` 是一个 VS Code 插件，用于在多个设备之间同步你的设置、插件、主题和代码片段。它特别适合远程开发场景（如 code-server）。

## ✨ 功能特性

- 支持同步以下内容到本地或远程服务器：
  - 用户设置（`settings.json`）
  - 快捷键绑定（`keybindings.json`）
  - 代码片段
  - 插件列表
- 支持 CLI 备份/恢复操作
- 可将设置保存到 Git、S3 或其他自定义后端
- **完全支持 Remote-SSH 远程开发环境**
- **自动检测不同 VSCode 版本的运行环境**

## 📦 安装方法

```bash
code --install-extension vscode-syncing
```

或在 VS Code 插件市场中搜索 “vscode-syncing”。

## ⚙️ 插件设置

| 设置项                               | 描述                                        | 默认值     |
|--------------------------------------|---------------------------------------------|------------|
| `vscode-syncing.exportMethod`        | 导出方式：local、gist 或 repository        | `local`    |
| `vscode-syncing.localPath`           | 本地导出路径                                | `""`       |
| `vscode-syncing.githubToken`         | GitHub 访问令牌                              | `""`       |
| `vscode-syncing.gistId`              | GitHub Gist ID                              | `""`       |
| `vscode-syncing.repositoryName`      | GitHub 仓库名（格式：owner/repo）           | `""`       |
| `vscode-syncing.repositoryBranch`    | GitHub 仓库分支                             | `main`     |

## 🐞 已知问题

- 目前尚不支持同步插件的启用/禁用状态
- 在 code-server 环境下，可能需要手动指定用户目录路径

## 🔧 支持的 VSCode 版本

本插件会自动检测并支持以下 VSCode 版本：

- **Visual Studio Code**（标准版）
- **Visual Studio Code Insiders**
- **Visual Studio Code Exploration**
- **VSCodium**（开源版）
- **VSCodium Insiders**
- **Code - OSS**
- **code-server**（远程开发）
- **Remote-SSH**（SSH 远程开发）
- **Cursor**（AI 编辑器）
- **WindSurf**（AI 编辑器）
- **Trae**（AI 编辑器）
- **Trae CN**（Trae 中文版）

### Remote-SSH 支持

当你使用 Remote-SSH 进行开发时，插件会自动检测远程环境，并使用正确的路径：

- **数据目录**：`~/.vscode-server/data`
- **插件目录**：`~/.vscode-server/extensions`
- **用户设置**：`~/.vscode-server/data/User/settings.json`

插件将根据远程服务器的文件系统自动适配并同步你的配置文件。

## 📝 更新日志

### 0.0.4

- 🎉 初始版本发布
- 支持设置和插件列表的同步

---

## 📚 参考链接

- [VS Code 插件 API](https://code.visualstudio.com/api)
- [code-server 项目](https://github.com/coder/code-server)

---

**享受使用 `vscode-syncing` 带来的高效配置同步体验吧！**


**祝你用得愉快，让开发环境始终如一！** 