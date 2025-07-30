import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionInfo, ExtensionsData } from './interfaces';
import { ErrorHandler, ErrorType } from './errorHandler';
import { logger } from './logger';
import { ExtensionImportResult } from './reportManager';
import { isExtensionIgnored } from '../types/constants';

export interface ExtensionComparisonResult {
  id: string;
  name: string;
  localVersion?: string;
  remoteVersion: string;
  status: 'not_installed' | 'version_mismatch' | 'up_to_date' | 'newer_local';
  localEnabled?: boolean;
  remoteEnabled: boolean;
  needsInstall: boolean;
  needsVersionUpdate: boolean;
  needsEnableDisable: boolean;
  fromExtensionsJson?: boolean;
}

export class ExtensionManager {
  /**
   * 比较本地扩展和远程扩展数据
   */
  async compareExtensions(remoteExtensions: ExtensionsData): Promise<ExtensionComparisonResult[]> {
    logger.info('开始比较本地和远程扩展');

    // 获取所有本地扩展（包括禁用的）
    const localExtensions = vscode.extensions.all
      .filter((ext) => !ext.packageJSON.isBuiltin)
      .reduce((map, ext) => {
        map.set(ext.id.toLowerCase(), {
          id: ext.id,
          version: ext.packageJSON.version,
          enabled: this.isExtensionEnabled(ext.id),
        });
        return map;
      }, new Map<string, { id: string; version: string; enabled: boolean }>());

    // 获取 extensions.json 数据
    const extensionsJsonData = await this.getExtensionsJsonData();
    const extensionsJsonMap = new Map<string, any>();
    extensionsJsonData.forEach((ext: any) => {
      extensionsJsonMap.set(ext.identifier.id.toLowerCase(), ext);
    });

    logger.info(`发现 ${localExtensions.size} 个本地扩展`);
    logger.info(`从 extensions.json 中发现 ${extensionsJsonData.length} 个扩展记录`);

    const results: ExtensionComparisonResult[] = [];

    for (const remoteExt of remoteExtensions.list) {
      // 跳过被忽略的扩展
      if (isExtensionIgnored(remoteExt.id)) {
        logger.info(`跳过导入忽略的扩展: ${remoteExt.id}`);
        continue;
      }

      const localExt = localExtensions.get(remoteExt.id.toLowerCase());
      const extensionsJsonExt = extensionsJsonMap.get(remoteExt.id.toLowerCase());

      let status: ExtensionComparisonResult['status'];
      let needsInstall = false;
      let needsVersionUpdate = false;
      let needsEnableDisable = false;

      if (!localExt) {
        // 扩展未通过 API 检测到，认为未安装
        status = 'not_installed';
        needsInstall = true;
        logger.debug(`扩展未安装: ${remoteExt.name} (${remoteExt.id})`);
      } else {
        // 通过 API 检测到扩展，认为已启用（忽略 extensions.json）
        // 扩展已安装，比较版本
        const versionComparison = this.compareVersions(localExt.version, remoteExt.version);

        if (versionComparison < 0) {
          status = 'version_mismatch';
          needsVersionUpdate = true;
          logger.debug(
            `扩展需要更新: ${remoteExt.name} ${localExt.version} -> ${remoteExt.version}`,
          );
        } else if (versionComparison > 0) {
          status = 'newer_local';
          logger.debug(
            `本地版本更新: ${remoteExt.name} ${localExt.version} > ${remoteExt.version}`,
          );
        } else {
          status = 'up_to_date';
          logger.debug(`扩展版本一致: ${remoteExt.name} v${localExt.version}`);
        }

        // 检查启用/禁用状态
        if (localExt.enabled !== remoteExt.enabled) {
          needsEnableDisable = true;
          logger.debug(
            `扩展状态需要更改: ${remoteExt.name} ${localExt.enabled ? '启用' : '禁用'} -> ${remoteExt.enabled ? '启用' : '禁用'}`,
          );
        }
      }

      results.push({
        id: remoteExt.id,
        name: remoteExt.name,
        localVersion: localExt?.version,
        remoteVersion: remoteExt.version,
        status,
        localEnabled: localExt?.enabled,
        remoteEnabled: remoteExt.enabled,
        needsInstall,
        needsVersionUpdate,
        needsEnableDisable,
        fromExtensionsJson: remoteExt.fromExtensionsJson || false,
      });
    }

    logger.info(`扩展比较完成: 总计 ${results.length} 个扩展`);
    return results;
  }

  /**
   * 应用扩展更改并返回详细结果
   */
  async applyExtensionChanges(
    comparisons: ExtensionComparisonResult[],
    progress?: vscode.Progress<{ increment?: number; message?: string }>,
  ): Promise<ExtensionImportResult[]> {
    const results: ExtensionImportResult[] = [];
    logger.info('开始应用扩展更改');

    const toInstall = comparisons.filter((c) => c.needsInstall);
    const toUpdate = comparisons.filter((c) => c.needsVersionUpdate);
    const toToggle = comparisons.filter((c) => c.needsEnableDisable && !c.needsInstall);

    let totalOperations = toInstall.length + toUpdate.length + toToggle.length;

    // 安装缺失的扩展
    for (const ext of toInstall) {
      try {
        progress?.report({
          increment: 100 / totalOperations,
          message: `安装扩展: ${ext.name}`,
        });

        await this.installExtension(ext.id, ext.remoteVersion);

        results.push({
          id: ext.id,
          name: ext.name,
          action: 'install',
          success: true,
          version: ext.remoteVersion,
        });

        logger.info(`扩展安装成功: ${ext.name} v${ext.remoteVersion}`);
      } catch (error) {
        results.push({
          id: ext.id,
          name: ext.name,
          action: 'install',
          success: false,
          error: (error as Error).message,
          version: ext.remoteVersion,
        });

        logger.error(`扩展安装失败: ${ext.name}`, error as Error);
      }
    }

    // 更新版本不匹配的扩展
    for (const ext of toUpdate) {
      try {
        progress?.report({
          increment: 100 / totalOperations,
          message: `更新扩展: ${ext.name}`,
        });

        const shouldUpdate = await this.promptForVersionUpdate(ext);
        if (shouldUpdate) {
          await this.updateExtension(ext.id, ext.remoteVersion);

          results.push({
            id: ext.id,
            name: ext.name,
            action: 'update',
            success: true,
            version: ext.remoteVersion,
          });

          logger.info(`扩展更新成功: ${ext.name} ${ext.localVersion} -> ${ext.remoteVersion}`);
        } else {
          results.push({
            id: ext.id,
            name: ext.name,
            action: 'skip',
            success: true,
            version: ext.localVersion,
          });

          logger.info(`用户跳过扩展更新: ${ext.name}`);
        }
      } catch (error) {
        results.push({
          id: ext.id,
          name: ext.name,
          action: 'update',
          success: false,
          error: (error as Error).message,
          version: ext.remoteVersion,
        });

        logger.error(`扩展更新失败: ${ext.name}`, error as Error);
      }
    }

    // 处理需要状态变更的扩展
    for (const ext of toToggle) {
      progress?.report({
        increment: 100 / totalOperations,
        message: `记录状态变更: ${ext.name}`,
      });

      this.logExtensionStateChange(ext.id, ext.remoteEnabled);

      results.push({
        id: ext.id,
        name: ext.name,
        action: ext.remoteEnabled ? 'enable' : 'disable',
        success: false,
        error: '需要手动更改扩展状态',
        version: ext.remoteVersion,
      });
    }

    logger.info(`扩展更改应用完成: 处理了 ${results.length} 个扩展`);
    return results;
  }

  /**
   * 生成比较报告
   */
  generateComparisonReport(comparisons: ExtensionComparisonResult[]): string {
    const toInstall = comparisons.filter((c) => c.needsInstall);
    const toUpdate = comparisons.filter((c) => c.needsVersionUpdate);
    const toToggle = comparisons.filter((c) => c.needsEnableDisable && !c.needsInstall);

    let report = `扩展同步详情:\n\n`;

    if (toInstall.length > 0) {
      report += `安装 ${toInstall.length} 个扩展\n`;
      const showCount = Math.min(3, toInstall.length);
      for (let i = 0; i < showCount; i++) {
        const ext = toInstall[i];
        report += `• ${ext.name}\n`;
      }
      if (toInstall.length > 3) {
        report += `• ...还有 ${toInstall.length - 3} 个\n`;
      }
      report += '\n';
    }

    if (toUpdate.length > 0) {
      report += `更新 ${toUpdate.length} 个扩展\n`;
      const showCount = Math.min(3, toUpdate.length);
      for (let i = 0; i < showCount; i++) {
        const ext = toUpdate[i];
        report += `• ${ext.name} ${ext.localVersion}→${ext.remoteVersion}\n`;
      }
      if (toUpdate.length > 3) {
        report += `• ...还有 ${toUpdate.length - 3} 个\n`;
      }
      report += '\n';
    }

    if (toToggle.length > 0) {
      report += `状态变更 ${toToggle.length} 个扩展\n`;
      const showCount = Math.min(3, toToggle.length);
      for (let i = 0; i < showCount; i++) {
        const ext = toToggle[i];
        const action = ext.remoteEnabled ? '启用' : '禁用';
        report += `• ${ext.name} - ${action}\n`;
      }
      if (toToggle.length > 3) {
        report += `• ...还有 ${toToggle.length - 3} 个\n`;
      }
    }

    return report;
  }

  /**
   * 生成比较摘要
   */
  generateComparisonSummary(comparisons: ExtensionComparisonResult[]): string {
    const toInstall = comparisons.filter((c) => c.needsInstall);
    const toUpdate = comparisons.filter((c) => c.needsVersionUpdate);
    const toToggle = comparisons.filter((c) => c.needsEnableDisable && !c.needsInstall);

    const parts = [];
    if (toInstall.length > 0) {
      parts.push(`安装 ${toInstall.length} 个`);
    }
    if (toUpdate.length > 0) {
      parts.push(`更新 ${toUpdate.length} 个`);
    }
    if (toToggle.length > 0) {
      parts.push(`更改状态 ${toToggle.length} 个`);
    }

    return parts.join('，');
  }

  /**
   * 检查扩展是否启用
   */
  private isExtensionEnabled(extensionId: string): boolean {
    const extension = vscode.extensions.getExtension(extensionId);
    return extension !== undefined;
  }

  /**
   * 获取 extensions.json 数据
   */
  private async getExtensionsJsonData(): Promise<any[]> {
    try {
      const extensionsDirectory = this.getExtensionsDirectory();
      const extensionsJsonPath = path.join(extensionsDirectory, 'extensions.json');

      if (!fs.existsSync(extensionsJsonPath)) {
        return [];
      }

      const content = fs.readFileSync(extensionsJsonPath, 'utf8');
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      logger.warn(`读取 extensions.json 失败: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 获取扩展目录
   */
  private getExtensionsDirectory(): string {
    if (process.env.VSCODE_PORTABLE) {
      return path.join(process.env.VSCODE_PORTABLE, 'data', 'extensions');
    }

    const platform = os.platform();
    const homeDir = os.homedir();

    switch (platform) {
      case 'win32':
      case 'darwin':
      case 'linux':
        return path.join(homeDir, '.vscode', 'extensions');
      default:
        return path.join(homeDir, '.vscode', 'extensions');
    }
  }

  /**
   * 比较版本号
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part < v2Part) {
        return -1;
      }
      if (v1Part > v2Part) {
        return 1;
      }
    }

    return 0;
  }

  /**
   * 安装扩展（参考GitHub实现，失败时使用API作为备用方案）
   */
  private async installExtension(extensionId: string, version: string): Promise<void> {
    try {
      const [publisher, name] = extensionId.split('.');
      if (!publisher || !name) {
        throw new Error(`无效的扩展ID格式: ${extensionId}`);
      }

      const extension: ExtensionInfo = {
        id: extensionId,
        name,
        publisher,
        version,
        description: '',
        isActive: false,
        enabled: true,
      };

      try {
        // 方法1: 尝试下载指定版本并手动安装
        logger.info(`开始下载扩展: ${extensionId} v${version}`);
        const downloadedExtension = await this.downloadExtension(extension);

        logger.info(`开始安装扩展: ${extensionId} v${version}`);
        await this.extractExtension(downloadedExtension);

        // 清理扩展缓存以确保VSCode识别新安装的扩展
        await this.cleanupExtensionCache();

        // 禁用该扩展的自动更新
        await this.disableExtensionAutoUpdate(extensionId);

        logger.info(`扩展安装成功: ${extensionId} v${version}`);
      } catch (downloadError) {
        logger.warn(
          `手动安装扩展失败: ${extensionId} v${version}, 错误: ${(downloadError as Error).message}`,
        );
        logger.info(`尝试使用VSCode API安装最新版本: ${extensionId}`);

        try {
          // 方法2: 使用VSCode API安装最新版本（备用方案）
          await this.installExtensionViaAPI(extensionId);
          logger.info(`通过API安装扩展成功: ${extensionId} (最新版本)`);
        } catch (apiError) {
          // 两种方法都失败，抛出原始错误
          logger.error(`API安装也失败: ${extensionId}, 错误: ${(apiError as Error).message}`);
          throw downloadError; // 抛出原始的下载/安装错误
        }
      }
    } catch (error) {
      throw ErrorHandler.createError(
        ErrorType.EXTENSION,
        `安装扩展失败: ${extensionId}`,
        error as Error,
      );
    }
  }

  /**
   * 更新扩展到指定版本
   */
  private async updateExtension(extensionId: string, version: string): Promise<void> {
    try {
      const [publisher, name] = extensionId.split('.');
      if (!publisher || !name) {
        throw new Error(`无效的扩展ID格式: ${extensionId}`);
      }

      const extension: ExtensionInfo = {
        id: extensionId,
        name,
        publisher,
        version,
        description: '',
        isActive: false,
        enabled: true,
      };

      // 先卸载当前版本
      logger.info(`卸载当前版本扩展: ${extensionId}`);
      await this.uninstallExtension(extension);

      // 下载新版本
      logger.info(`下载新版本扩展: ${extensionId} v${version}`);
      const downloadedExtension = await this.downloadExtension(extension);

      // 安装新版本
      logger.info(`安装新版本扩展: ${extensionId} v${version}`);
      await this.extractExtension(downloadedExtension);

      logger.info(`扩展更新成功: ${extensionId} v${version}`);
    } catch (error) {
      throw ErrorHandler.createError(
        ErrorType.EXTENSION,
        `更新扩展失败: ${extensionId}`,
        error as Error,
      );
    }
  }

  /**
   * 下载扩展（参考GitHub实现）
   */
  private async downloadExtension(extension: ExtensionInfo): Promise<ExtensionInfo> {
    try {
      const tempDir = path.join(os.tmpdir(), 'vscode-syncing-extensions');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const vsixFileName = `${extension.id}-${extension.version}.vsix`;
      const vsixFilePath = path.join(tempDir, vsixFileName);

      // 使用优化的下载工具
      const { downloadExtensionVsix } = await import('../utils/downloadUtils.js');
      await downloadExtensionVsix(extension.id, extension.version, vsixFilePath);

      return { ...extension, vsixFilepath: vsixFilePath };
    } catch (error) {
      throw ErrorHandler.createError(
        ErrorType.EXTENSION,
        `下载扩展失败: ${extension.id}`,
        error as Error,
      );
    }
  }

  /**
   * 解压安装扩展（参考GitHub实现）
   */
  private async extractExtension(extension: ExtensionInfo): Promise<ExtensionInfo> {
    const { vsixFilepath } = extension;
    if (!vsixFilepath || !fs.existsSync(vsixFilepath)) {
      throw new Error(`VSIX文件不存在: ${vsixFilepath}`);
    }

    try {
      // 创建临时目录
      const tempDir = path.join(
        os.tmpdir(),
        `vscode-syncing-extract-${extension.id}-${Date.now()}`,
      );
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        // 解压VSIX文件
        await this.extractVsixFile(vsixFilepath, tempDir);

        // 获取扩展安装目录
        const extPath = this.getExtensionInstallDirectory(extension.id, extension.version);

        // 清空目标目录
        if (fs.existsSync(extPath)) {
          await this.removeDirectory(extPath);
        }
        fs.mkdirSync(extPath, { recursive: true });

        // 复制扩展文件
        const extensionSourceDir = path.join(tempDir, 'extension');
        if (fs.existsSync(extensionSourceDir)) {
          await this.copyDirectory(extensionSourceDir, extPath);
        } else {
          throw new Error(`扩展源目录不存在: ${extensionSourceDir}`);
        }

        return extension;
      } finally {
        // 清理临时目录
        if (fs.existsSync(tempDir)) {
          await this.removeDirectory(tempDir);
        }
        // 清理VSIX文件
        if (fs.existsSync(vsixFilepath)) {
          fs.unlinkSync(vsixFilepath);
        }
      }
    } catch (error) {
      throw ErrorHandler.createError(
        ErrorType.EXTENSION,
        `解压扩展失败: ${extension.id}`,
        error as Error,
      );
    }
  }

  /**
   * 卸载扩展
   */
  private async uninstallExtension(extension: ExtensionInfo): Promise<ExtensionInfo> {
    try {
      const localExtension = vscode.extensions.getExtension(extension.id);
      const extensionPath = localExtension
        ? localExtension.extensionPath
        : this.getExtensionInstallDirectory(extension.id, extension.version);

      if (fs.existsSync(extensionPath)) {
        await this.removeDirectory(extensionPath);
      }

      return extension;
    } catch (error) {
      throw ErrorHandler.createError(
        ErrorType.EXTENSION,
        `卸载扩展失败: ${extension.id}`,
        error as Error,
      );
    }
  }

  /**
   * 解压VSIX文件
   */
  private async extractVsixFile(vsixFilePath: string, extractDir: string): Promise<void> {
    const yauzl = require('yauzl');

    return new Promise((resolve, reject) => {
      yauzl.open(vsixFilePath, { lazyEntries: true }, (err: any, zipfile: any) => {
        if (err) {
          reject(err);
          return;
        }

        zipfile.readEntry();

        zipfile.on('entry', (entry: any) => {
          if (/\/$/.test(entry.fileName)) {
            // 目录条目
            const dirPath = path.join(extractDir, entry.fileName);
            fs.mkdirSync(dirPath, { recursive: true });
            zipfile.readEntry();
          } else {
            // 文件条目
            zipfile.openReadStream(entry, (err: any, readStream: any) => {
              if (err) {
                reject(err);
                return;
              }

              const filePath = path.join(extractDir, entry.fileName);
              const dirPath = path.dirname(filePath);

              // 确保目录存在
              if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
              }

              const writeStream = fs.createWriteStream(filePath);
              readStream.pipe(writeStream);

              writeStream.on('close', () => {
                zipfile.readEntry();
              });

              writeStream.on('error', reject);
            });
          }
        });

        zipfile.on('end', () => {
          resolve();
        });

        zipfile.on('error', reject);
      });
    });
  }

  /**
   * 获取扩展安装目录（正确的VSCode扩展目录格式）
   */
  private getExtensionInstallDirectory(extensionId: string, version: string): string {
    const extensionsDir = this.getExtensionsDirectory();
    // VSCode扩展目录格式: publisher.name-version
    return path.join(extensionsDir, `${extensionId}-${version}`);
  }

  /**
   * 递归删除目录
   */
  private async removeDirectory(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        await this.removeDirectory(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    }

    fs.rmdirSync(dirPath);
  }

  /**
   * 递归复制目录
   */
  private async copyDirectory(sourceDir: string, targetDir: string): Promise<void> {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const files = fs.readdirSync(sourceDir);

    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      const stat = fs.statSync(sourcePath);

      if (stat.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  /**
   * 询问用户是否更新版本
   */
  private async promptForVersionUpdate(ext: ExtensionComparisonResult): Promise<boolean> {
    const message =
      `扩展 "${ext.name}" 有新版本可用：\n` +
      `当前版本: ${ext.localVersion}\n` +
      `远程版本: ${ext.remoteVersion}\n\n` +
      `是否更新到指定版本？`;

    const choice = await vscode.window.showInformationMessage(
      message,
      { modal: true },
      '更新到指定版本',
      '跳过',
    );

    return choice === '更新到指定版本';
  }

  /**
   * 记录扩展状态变更
   */
  private logExtensionStateChange(extensionId: string, enabled: boolean): void {
    const action = enabled ? '启用' : '禁用';
    logger.info(`需要${action}扩展: ${extensionId}`);
  }

  /**
   * 重新加载扩展以确保VSCode识别新安装的扩展
   */
  private async reloadExtensions(): Promise<void> {
    try {
      // 方法1: 尝试使用VSCode内置命令重新加载扩展
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    } catch (error) {
      // 如果重新加载窗口失败，记录警告但不抛出错误
      logger.warn(
        `重新加载窗口失败，扩展可能需要手动重启VSCode才能生效: ${(error as Error).message}`,
      );
    }
  }

  /**
   * 清理VSCode扩展缓存文件
   */
  private async cleanupExtensionCache(): Promise<void> {
    try {
      const extensionsDir = this.getExtensionsDirectory();

      // 清理 .obsolete 文件
      const obsoleteFile = path.join(extensionsDir, '.obsolete');
      if (fs.existsSync(obsoleteFile)) {
        fs.unlinkSync(obsoleteFile);
        logger.info('已清理 .obsolete 文件');
      }

      // 清理 extensions.json 文件以强制VSCode重新扫描
      const extensionsJsonFile = path.join(extensionsDir, 'extensions.json');
      if (fs.existsSync(extensionsJsonFile)) {
        fs.unlinkSync(extensionsJsonFile);
        logger.info('已清理 extensions.json 文件');
      }
    } catch (error) {
      logger.warn(`清理扩展缓存失败: ${(error as Error).message}`);
    }
  }

  /**
   * 使用VSCode API安装扩展（最新版本）
   */
  private async installExtensionViaAPI(extensionId: string): Promise<void> {
    try {
      logger.info(`使用VSCode API安装扩展: ${extensionId}`);

      // 使用VSCode内置命令安装扩展
      await vscode.commands.executeCommand('workbench.extensions.installExtension', extensionId);

      // 等待一段时间让扩展安装完成
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 验证扩展是否安装成功
      const installedExtension = vscode.extensions.getExtension(extensionId);
      if (!installedExtension) {
        throw new Error(`扩展安装后未找到: ${extensionId}`);
      }

      // 禁用该扩展的自动更新
      await this.disableExtensionAutoUpdate(extensionId);

      logger.info(`VSCode API安装扩展成功: ${extensionId}`);
    } catch (error) {
      throw new Error(`VSCode API安装扩展失败: ${extensionId}, 错误: ${(error as Error).message}`);
    }
  }

  /**
   * 禁用指定扩展的自动更新
   */
  private async disableExtensionAutoUpdate(extensionId: string): Promise<void> {
    try {
      logger.info(`禁用扩展自动更新: ${extensionId}`);

      // 获取当前的扩展自动更新设置
      const config = vscode.workspace.getConfiguration();
      const currentIgnoredExtensions = config.get<string[]>('extensions.autoUpdate.ignoreList', []);

      // 检查是否已经在忽略列表中
      if (!currentIgnoredExtensions.includes(extensionId)) {
        // 添加到忽略列表
        const updatedIgnoredExtensions = [...currentIgnoredExtensions, extensionId];

        // 更新配置
        await config.update(
          'extensions.autoUpdate.ignoreList',
          updatedIgnoredExtensions,
          vscode.ConfigurationTarget.Global,
        );

        logger.info(`已将扩展 ${extensionId} 添加到自动更新忽略列表`);
      } else {
        logger.info(`扩展 ${extensionId} 已在自动更新忽略列表中`);
      }
    } catch (error) {
      // 禁用自动更新失败不应该影响安装过程，只记录警告
      logger.warn(`禁用扩展自动更新失败: ${extensionId}, 错误: ${(error as Error).message}`);
    }
  }

  /**
   * 批量禁用扩展自动更新
   */
  private async disableExtensionsAutoUpdate(extensionIds: string[]): Promise<void> {
    try {
      if (extensionIds.length === 0) {
        return;
      }

      logger.info(`批量禁用扩展自动更新: ${extensionIds.length} 个扩展`);

      // 获取当前的扩展自动更新设置
      const config = vscode.workspace.getConfiguration();
      const currentIgnoredExtensions = config.get<string[]>('extensions.autoUpdate.ignoreList', []);

      // 找出需要添加的扩展
      const extensionsToAdd = extensionIds.filter((id) => !currentIgnoredExtensions.includes(id));

      if (extensionsToAdd.length > 0) {
        // 合并到忽略列表
        const updatedIgnoredExtensions = [...currentIgnoredExtensions, ...extensionsToAdd];

        // 更新配置
        await config.update(
          'extensions.autoUpdate.ignoreList',
          updatedIgnoredExtensions,
          vscode.ConfigurationTarget.Global,
        );

        logger.info(
          `已将 ${extensionsToAdd.length} 个扩展添加到自动更新忽略列表: ${extensionsToAdd.join(', ')}`,
        );
      } else {
        logger.info(`所有扩展都已在自动更新忽略列表中`);
      }
    } catch (error) {
      logger.warn(`批量禁用扩展自动更新失败, 错误: ${(error as Error).message}`);
    }
  }
}
