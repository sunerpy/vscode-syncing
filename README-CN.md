# vscode-syncing

[English](./README.md) | 简体中文


[![CI](https://github.com/sunerpy/vscode-syncing/workflows/CI/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/ci.yml)
[![PR Check](https://github.com/sunerpy/vscode-syncing/workflows/PR%20Check/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/pr-check.yml)
[![Release](https://github.com/sunerpy/vscode-syncing/workflows/GitHub%20Release/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/release.yml)
[![Nightly Build](https://github.com/sunerpy/vscode-syncing/workflows/Nightly%20Build/badge.svg)](https://github.com/sunerpy/vscode-syncing/actions/workflows/nightly.yml)

`vscode-syncing` 是一个 VS Code 插件，用于在多台设备之间同步你的设置、插件、主题和代码片段。它尤其适用于远程开发场景（如 code-server）。

## ✨ 功能亮点

- **完整配置同步**：同步以下内容到本地或远程服务器：
  - 用户设置（`settings.json`）
  - 快捷键绑定（`keybindings.json`）
  - 代码片段
  - 插件列表（支持版本控制）
  - 主题和配色方案
- **高级插件管理功能**：
  - 双重安装策略（手动安装 + API 回退）
  - 自动禁用插件自动更新
  - 智能版本比较与冲突解决
  - 支持禁用/不可用插件同步（实验性）
- **灵活的导出选项**：
  - 导出到本地文件系统
  - 集成 GitHub Gist
  - 集成 GitHub 仓库
- **智能插件过滤机制**：
  - 用户可配置的忽略模式（支持正则表达式）
  - 自动排除当前插件自身
  - 智能去重与日志优化
- **多环境支持**：
  - **全面支持 Remote-SSH 远程开发**
  - **自动识别 VSCode 版本与环境**
  - 跨平台兼容（Windows、macOS、Linux）

## 📦 安装方式

```bash
code --install-extension vscode-syncing
```

或在插件市场中搜索 “vscode-syncing” 进行安装。

## 🚀 快速开始

1. **配置导出方式**：在设置中选择你偏好的同步方式
2. **设置认证信息**：配置 GitHub Token 以启用 Gist 或仓库同步
3. **导出配置**：`Ctrl+Shift+P` → 执行 “Export All Configurations”
4. **其他设备导入**：`Ctrl+Shift+P` → 执行 “Import All Configurations”

## ⚙️ 插件设置项

### 基础设置

| 设置项                                | 描述                                       | 默认值   |
|---------------------------------------|--------------------------------------------|----------|
| `vscode-syncing.exportMethod`         | 导出方式：local、gist 或 repository        | `local`  |
| `vscode-syncing.localPath`            | 本地导出路径                                | `""`     |
| `vscode-syncing.githubToken`          | GitHub 访问令牌                             | `""`     |
| `vscode-syncing.gistId`               | GitHub Gist ID                              | `""`     |
| `vscode-syncing.repositoryName`       | GitHub 仓库名（格式：owner/repo）           | `""`     |
| `vscode-syncing.repositoryBranch`     | GitHub 仓库分支名                           | `main`   |

### 高级设置

| 设置项                                       | 描述                                               | 默认值   |
|----------------------------------------------|----------------------------------------------------|----------|
| `vscode-syncing.syncDisabledExtensions`      | **实验性**：同步禁用或不可用的插件                | `false`  |
| `vscode-syncing.ignoredExtensions`           | 同步时忽略的插件（支持正则表达式）                 | `[]`     |

### 插件忽略模式

`ignoredExtensions` 支持精确匹配和正则表达式，例如：

```json
{
  "vscode-syncing.ignoredExtensions": [
    "ms-vscode.*",           // 忽略所有微软官方插件
    ".*\\.theme",            // 忽略所有主题插件
    "github.copilot",        // 忽略特定插件
    ".*debug.*",             // 忽略名称中包含 debug 的插件
    "specific-extension-id"  // 精确匹配
  ]
}
```

特性：

- 🔍 **支持正则匹配**：灵活过滤插件
- 🛡️ **自动保护机制**：自动忽略当前插件自身
- 📝 **灵活配置**：可混合使用精确匹配和正则
- 🚫 **忽略大小写**
- ⚠️ **错误容忍**：非法正则自动回退为精确匹配

## 🛠️ 可用命令

可通过 `Ctrl+Shift+P`（或 macOS 上的 `Cmd+Shift+P`）访问以下命令：

### 导入类命令
- `Import All Configurations` - 导入全部设置、插件、主题和片段
- `Import Extensions List` - 仅导入插件列表
- `Import Settings` - 仅导入用户设置
- `Import Themes` - 仅导入主题
- `Import Snippets` - 仅导入代码片段

### 导出类命令
- `Export All Configurations` - 导出全部配置
- `Export Extensions List` - 仅导出插件列表
- `Export Settings` - 仅导出用户设置
- `Export Themes` - 仅导出主题
- `Export Snippets` - 仅导出代码片段

### 配置命令
- `Configure Export Options` - 配置导出方式及认证信息

## 🧩 支持的 VSCode 版本

本插件自动检测并支持以下 VSCode 版本：

- **Visual Studio Code**
- **VS Code Insiders**
- **VS Code Exploration**
- **VSCodium**
- **VSCodium Insiders**
- **Code - OSS**
- **code-server**
- **Remote-SSH**

### Remote-SSH 支持

在 Remote-SSH 模式下，插件自动识别并适配远程文件路径：

- 数据目录：`~/.vscode-server/data`
- 插件目录：`~/.vscode-server/extensions`
- 用户设置路径：`~/.vscode-server/data/User/settings.json`

无需手动干预，即可在远程服务器同步 VSCode 配置。

## 🚀 高级特性

### 插件版本管理机制

**双重安装策略**：
1. **主策略**：手动下载并安装指定版本插件
2. **备选策略**：使用 VSCode API 安装最新版本（当主策略失败）

**自动更新保护**：
- 自动将插件加入 VSCode 的更新忽略列表
- 避免同步后被自动升级
- 保证不同设备版本一致性

**智能版本冲突解决**：
- 对比本地和远程插件版本
- 提示用户进行决策
- 自动处理版本不一致问题

### 实验性功能：禁用插件同步

开启 `syncDisabledExtensions` 后：

- 会尝试同步 `extensions.json` 中被禁用但本地不存在的插件
- 同时保持其为“禁用”状态
- 有助于完整复制远程环境

⚠️ 注意事项：

- 可能会增加同步时间
- 实验功能，建议熟练用户使用
- 对环境一致性要求高时非常有用

## 🐞 已知问题

- 插件启用/禁用状态目前无法自动同步（需手动操作）
- code-server 环境下可能需要手动指定用户目录
- 禁用插件同步功能对部分插件兼容性有限

## 🧭 故障排查

### 常见问题排查指南
（内容待补充）


## 📝 更新日志

[更新日志](./CHANGELOG.md)

---

## 📚 参考链接

- [VS Code 插件 API](https://code.visualstudio.com/api)
- [code-server 项目](https://github.com/coder/code-server)

---

**享受使用 `vscode-syncing` 带来的高效配置同步体验吧！**


**祝你用得愉快，让开发a境始终如一！** 