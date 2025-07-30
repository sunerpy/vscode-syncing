# Change Log

All notable changes to the "vscode-syncing" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.2.4](https://github.com/sunerpy/vscode-syncing/compare/v0.2.3...v0.2.4) (2025-07-30)


### Bug Fixes

* **core:** 重构核心模块代码,修复用户设置导出失败的问题 ([#27](https://github.com/sunerpy/vscode-syncing/issues/27)) ([ebd145c](https://github.com/sunerpy/vscode-syncing/commit/ebd145ccfd0b708f93cc20cb73d509aca3e5d12b))

## [0.2.3](https://github.com/sunerpy/vscode-syncing/compare/v0.2.2...v0.2.3) (2025-07-25)


### Bug Fixes

* **esbuild:** 修复引入外部依赖时pnpm构建异常的问题 ([#25](https://github.com/sunerpy/vscode-syncing/issues/25)) ([e5fcb1e](https://github.com/sunerpy/vscode-syncing/commit/e5fcb1e54dac2a6bd2d235037e3e4ff16fce7192))
* 移除 activationEvents 空数组 ([#23](https://github.com/sunerpy/vscode-syncing/issues/23)) ([d176746](https://github.com/sunerpy/vscode-syncing/commit/d176746a24729fa194f1fcb505d5b8ea38bb5034))

## [0.2.2](https://github.com/sunerpy/vscode-syncing/compare/v0.2.1...v0.2.2) (2025-07-24)


### Bug Fixes

* 修复release创建失败的问题 ([#20](https://github.com/sunerpy/vscode-syncing/issues/20)) ([af58248](https://github.com/sunerpy/vscode-syncing/commit/af58248c833c981606342d9f7723e5938d1a5512))

## [0.2.1](https://github.com/sunerpy/vscode-syncing/compare/v0.2.0...v0.2.1) (2025-07-24)


### Bug Fixes

* **datacollector:** 添加 jsonc-parser 依赖并优化配置解析,修复settings.json中的注释解析失败的问题 ([#18](https://github.com/sunerpy/vscode-syncing/issues/18)) ([c05a417](https://github.com/sunerpy/vscode-syncing/commit/c05a417609b6a76157f77a96792a0679d20b1357))

## [0.2.0](https://github.com/sunerpy/vscode-syncing/compare/v0.1.0...v0.2.0) (2025-07-24)


### Features

* **sync:** 优化GitHub同步逻辑并增强错误处理 ([#16](https://github.com/sunerpy/vscode-syncing/issues/16)) ([abfc2b9](https://github.com/sunerpy/vscode-syncing/commit/abfc2b993cb856e2618f330d104fe8086db790ae))

## [0.1.0](https://github.com/sunerpy/vscode-syncing/compare/v0.0.5...v0.1.0) (2025-07-22)


### Features

* 初始化版本清单文件 ([#8](https://github.com/sunerpy/vscode-syncing/issues/8)) ([8382e6e](https://github.com/sunerpy/vscode-syncing/commit/8382e6e1622d106f47d850571190f853e8c15731))
* 更新 GitHub Actions 工作流和预提交钩子 ([#6](https://github.com/sunerpy/vscode-syncing/issues/6)) ([44e1999](https://github.com/sunerpy/vscode-syncing/commit/44e1999d63c4d8741e27f6c6233b328043b1eda1))
* 更新发布工作流以支持标签推送和自动同步版本 ([#7](https://github.com/sunerpy/vscode-syncing/issues/7)) ([d6b3465](https://github.com/sunerpy/vscode-syncing/commit/d6b346567b6b860b1e221803d5995c96cc606618))
* 更新发布工作流配置，新增 Node.js 版本和包名设置 ([#12](https://github.com/sunerpy/vscode-syncing/issues/12)) ([042feba](https://github.com/sunerpy/vscode-syncing/commit/042febac412da7315cf7f469ec0f430ec6052b06))
* 更新版本清单文件至 0.0.6 ([#10](https://github.com/sunerpy/vscode-syncing/issues/10)) ([a0e23a9](https://github.com/sunerpy/vscode-syncing/commit/a0e23a908c492774dff258da0b931c1e9df2ba4c))

## [Unreleased]

- Initial release
