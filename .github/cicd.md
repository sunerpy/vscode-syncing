# GitHub 工作流说明

本项目包含以下 GitHub Actions 工作流：

## 📋 工作流概览

### 1. CI (`ci.yml`)
**触发条件**: PR 和推送到 main/master 分支
**功能**:
- 多平台测试 (Ubuntu, Windows, macOS)
- 多 Node.js 版本测试 (18, 20)
- 类型检查、代码检查、编译、测试
- 安全检查 (仅 PR)
- 构建产物上传

### 2. PR Check (`pr-check.yml`)
**触发条件**: 仅 PR
**功能**:
- 代码质量检查
- 依赖检查
- 安全检查
- 多平台构建测试

### 3. Release (`release.yml`)
**触发条件**: 推送 tag (格式: v*)
**功能**:
- 自动发布到 GitHub Releases
- 发布到 VS Code Marketplace
- 更新 CHANGELOG.md

### 4. Nightly Build (`nightly.yml`)
**触发条件**: 每日凌晨 2 点 + 手动触发
**功能**:
- 每日构建测试
- 依赖更新检查
- 安全漏洞扫描
- 构建报告生成

## 🔧 配置要求

### 必需的 Secrets

在 GitHub 仓库设置中添加以下 secrets：

1. **VSCODE_MARKETPLACE_TOKEN** (可选)
   - 用于自动发布到 VS Code Marketplace
   - 获取方式: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token

### 可选配置

1. **分支保护规则**
   - 建议为 main/master 分支启用保护
   - 要求 PR 通过所有检查

2. **自动合并**
   - 可配置自动合并满足条件的 PR

## 🚀 使用方法

### 发布新版本

1. 更新 `package.json` 中的版本号
2. 创建并推送 tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. 工作流会自动:
   - 运行所有测试
   - 创建 GitHub Release
   - 发布到 VS Code Marketplace (如果配置了 token)

### 手动触发夜间构建

1. 进入 GitHub Actions 页面
2. 选择 "Nightly Build" 工作流
3. 点击 "Run workflow"

### 查看构建产物

1. 进入 GitHub Actions 页面
2. 选择任意工作流运行
3. 在 "Artifacts" 部分下载构建产物

## 📊 工作流状态徽章

可以在 README.md 中添加以下徽章：

```markdown
![CI](https://github.com/{owner}/{repo}/workflows/CI/badge.svg)
![PR Check](https://github.com/{owner}/{repo}/workflows/PR%20Check/badge.svg)
![Release](https://github.com/{owner}/{repo}/workflows/Release/badge.svg)
```

## 🔍 故障排除

### 常见问题

1. **构建失败**
   - 检查 Node.js 版本兼容性
   - 确认所有依赖都已安装
   - 查看详细的错误日志

2. **发布失败**
   - 确认 VSCODE_MARKETPLACE_TOKEN 已正确配置
   - 检查版本号格式是否正确
   - 确认扩展 ID 和发布者信息正确

3. **测试失败**
   - 检查测试环境配置
   - 确认测试文件路径正确
   - 查看测试输出日志

### 调试技巧

1. **本地测试**
   ```bash
   # 运行所有检查
   pnpm run check-types
   pnpm run lint
   pnpm run test
   pnpm run package
   ```

2. **查看工作流日志**
   - 在 GitHub Actions 页面查看详细日志
   - 使用 `echo` 命令添加调试信息

3. **重新运行失败的工作流**
   - 在 GitHub Actions 页面点击 "Re-run jobs"

## 📝 自定义配置

### 修改触发条件

编辑对应工作流文件的 `on` 部分：

```yaml
on:
  push:
    branches: [ main, develop ]  # 添加更多分支
  pull_request:
    branches: [ main, develop ]  # 添加更多分支
```

### 添加新的检查步骤

在工作流文件中添加新的 step：

```yaml
- name: Custom Check
  run: |
    echo "Running custom check..."
    # 你的检查命令
```

### 修改缓存策略

调整 pnpm 缓存配置：

```yaml
- name: Setup pnpm cache
  uses: actions/cache@v4
  with:
    path: ${{ env.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request
5. 等待 CI 检查通过
6. 请求代码审查
7. 合并到主分支

---

如有问题，请查看 [GitHub Actions 文档](https://docs.github.com/en/actions) 或创建 Issue。 