import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DataType } from './interfaces';
import { logger } from './logger';

export interface ImportResult {
  type: DataType;
  success: boolean;
  message: string;
  error?: string;
  details?: any;
}

export interface ExtensionImportResult {
  id: string;
  name: string;
  action: 'install' | 'update' | 'enable' | 'disable' | 'skip';
  success: boolean;
  error?: string;
  version?: string;
}

export interface ImportReport {
  timestamp: string;
  type: 'single' | 'all';
  dataTypes: DataType[];
  results: ImportResult[];
  extensionResults?: ExtensionImportResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
    duration: number;
  };
}

export class ReportManager {
  private static readonly MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_LOG_FILES = 5;
  private reportsDir: string;

  constructor() {
    // 获取扩展存储目录
    const extensionPath = vscode.extensions.getExtension('your-extension-id')?.extensionPath || '';
    this.reportsDir = path.join(extensionPath, 'logs', 'reports');
    this.ensureReportsDirectory();
  }

  /**
   * 生成导入报告
   */
  async generateImportReport(
    type: 'single' | 'all',
    dataTypes: DataType[],
    results: ImportResult[],
    extensionResults?: ExtensionImportResult[],
    startTime?: number,
  ): Promise<ImportReport> {
    const endTime = Date.now();
    const duration = startTime ? endTime - startTime : 0;

    const report: ImportReport = {
      timestamp: new Date().toISOString(),
      type,
      dataTypes,
      results,
      extensionResults,
      summary: {
        total: results.length,
        success: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        duration,
      },
    };

    // 保存报告到本地
    await this.saveReportToFile(report);

    // 显示报告给用户
    await this.showReportToUser(report);

    return report;
  }

  /**
   * 生成扩展导入报告
   */
  generateExtensionReport(extensionResults: ExtensionImportResult[]): string {
    let report = '=== 扩展导入报告 ===\n\n';

    const installed = extensionResults.filter((r) => r.action === 'install');
    const updated = extensionResults.filter((r) => r.action === 'update');
    const enabled = extensionResults.filter((r) => r.action === 'enable');
    const disabled = extensionResults.filter((r) => r.action === 'disable');
    const failed = extensionResults.filter((r) => !r.success);

    // 统计信息
    report += `总计: ${extensionResults.length} 个扩展\n`;
    report += `成功: ${extensionResults.filter((r) => r.success).length} 个\n`;
    report += `失败: ${failed.length} 个\n\n`;

    // 安装的扩展
    if (installed.length > 0) {
      report += `✅ 已安装 (${installed.length}):\n`;
      installed.forEach((ext) => {
        const status = ext.success ? '✓' : '✗';
        report += `  ${status} ${ext.name} v${ext.version}\n`;
        if (!ext.success && ext.error) {
          report += `    错误: ${ext.error}\n`;
        }
      });
      report += '\n';
    }

    // 更新的扩展
    if (updated.length > 0) {
      report += `🔄 已更新 (${updated.length}):\n`;
      updated.forEach((ext) => {
        const status = ext.success ? '✓' : '✗';
        report += `  ${status} ${ext.name} v${ext.version}\n`;
        if (!ext.success && ext.error) {
          report += `    错误: ${ext.error}\n`;
        }
      });
      report += '\n';
    }

    // 启用的扩展
    if (enabled.length > 0) {
      report += `🟢 已启用 (${enabled.length}):\n`;
      enabled.forEach((ext) => {
        const status = ext.success ? '✓' : '✗';
        report += `  ${status} ${ext.name}\n`;
        if (!ext.success && ext.error) {
          report += `    错误: ${ext.error}\n`;
        }
      });
      report += '\n';
    }

    // 禁用的扩展
    if (disabled.length > 0) {
      report += `🔴 已禁用 (${disabled.length}):\n`;
      disabled.forEach((ext) => {
        const status = ext.success ? '✓' : '✗';
        report += `  ${status} ${ext.name}\n`;
        if (!ext.success && ext.error) {
          report += `    错误: ${ext.error}\n`;
        }
      });
      report += '\n';
    }

    // 失败详情
    if (failed.length > 0) {
      report += `❌ 失败详情:\n`;
      failed.forEach((ext) => {
        report += `  • ${ext.name} (${ext.action})\n`;
        report += `    错误: ${ext.error || '未知错误'}\n`;
      });
    }

    return report;
  }

  /**
   * 生成综合报告
   */
  generateComprehensiveReport(report: ImportReport): string {
    let content = '=== VSCode 配置导入报告 ===\n\n';

    content += `时间: ${new Date(report.timestamp).toLocaleString()}\n`;
    content += `类型: ${report.type === 'all' ? '导入所有配置' : '单项导入'}\n`;
    content += `耗时: ${(report.summary.duration / 1000).toFixed(2)} 秒\n\n`;

    // 总体统计
    content += `📊 总体统计:\n`;
    content += `  总计: ${report.summary.total} 项\n`;
    content += `  成功: ${report.summary.success} 项\n`;
    content += `  失败: ${report.summary.failed} 项\n`;
    content += `  成功率: ${((report.summary.success / report.summary.total) * 100).toFixed(1)}%\n\n`;

    // 各项详情
    content += `📋 详细结果:\n`;
    report.results.forEach((result) => {
      const status = result.success ? '✅' : '❌';
      const typeName = this.getTypeDisplayName(result.type);
      content += `  ${status} ${typeName}: ${result.message}\n`;
      if (!result.success && result.error) {
        content += `    错误: ${result.error}\n`;
      }
    });

    // 扩展详情
    if (report.extensionResults && report.extensionResults.length > 0) {
      content += '\n' + this.generateExtensionReport(report.extensionResults);
    }

    return content;
  }

  /**
   * 保存报告到文件
   */
  private async saveReportToFile(report: ImportReport): Promise<void> {
    try {
      const fileName = `import-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const filePath = path.join(this.reportsDir, fileName);

      // 检查日志文件大小并清理
      await this.cleanupOldReports();

      // 保存报告
      const reportContent = JSON.stringify(report, null, 2);
      fs.writeFileSync(filePath, reportContent, 'utf8');

      // 同时保存可读的文本版本
      const textFileName = fileName.replace('.json', '.txt');
      const textFilePath = path.join(this.reportsDir, textFileName);
      const textContent = this.generateComprehensiveReport(report);
      fs.writeFileSync(textFilePath, textContent, 'utf8');

      logger.info(`导入报告已保存: ${filePath}`);
    } catch (error) {
      logger.error('保存导入报告失败', error as Error);
    }
  }

  /**
   * 向用户显示报告
   */
  private async showReportToUser(report: ImportReport): Promise<void> {
    const content = this.generateComprehensiveReport(report);

    // 创建并显示报告文档
    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'plaintext',
    });

    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.Beside,
    });

    // 显示摘要通知
    const successRate = ((report.summary.success / report.summary.total) * 100).toFixed(1);
    const message = `导入完成！成功 ${report.summary.success}/${report.summary.total} 项 (${successRate}%)`;

    if (report.summary.failed > 0) {
      vscode.window.showWarningMessage(message);
    } else {
      vscode.window.showInformationMessage(message);
    }
  }

  /**
   * 确保报告目录存在
   */
  private ensureReportsDirectory(): void {
    try {
      if (!fs.existsSync(this.reportsDir)) {
        fs.mkdirSync(this.reportsDir, { recursive: true });
      }
    } catch (error) {
      logger.error('创建报告目录失败', error as Error);
      // 使用临时目录作为备选
      const os = require('os');
      this.reportsDir = path.join(os.tmpdir(), 'vscode-syncing-reports');
      if (!fs.existsSync(this.reportsDir)) {
        fs.mkdirSync(this.reportsDir, { recursive: true });
      }
    }
  }

  /**
   * 清理旧的报告文件
   */
  private async cleanupOldReports(): Promise<void> {
    try {
      const files = fs.readdirSync(this.reportsDir);
      const reportFiles = files
        .filter(
          (file) =>
            file.startsWith('import-report-') && (file.endsWith('.json') || file.endsWith('.txt')),
        )
        .map((file) => ({
          name: file,
          path: path.join(this.reportsDir, file),
          stats: fs.statSync(path.join(this.reportsDir, file)),
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      // 检查总大小
      const totalSize = reportFiles.reduce((sum, file) => sum + file.stats.size, 0);

      if (
        totalSize > ReportManager.MAX_LOG_SIZE ||
        reportFiles.length > ReportManager.MAX_LOG_FILES * 2
      ) {
        // 保留最新的文件，删除旧的
        const filesToKeep = ReportManager.MAX_LOG_FILES * 2; // JSON + TXT 文件
        const filesToDelete = reportFiles.slice(filesToKeep);

        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          logger.info(`已删除旧报告文件: ${file.name}`);
        }
      }
    } catch (error) {
      logger.warn(`清理旧报告文件时出错: ${(error as Error).message}`);
    }
  }

  /**
   * 获取数据类型显示名称
   */
  private getTypeDisplayName(type: DataType): string {
    switch (type) {
      case DataType.EXTENSIONS:
        return '扩展';
      case DataType.SETTINGS:
        return '设置';
      case DataType.THEMES:
        return '主题';
      case DataType.SNIPPETS:
        return '代码片段';
      default:
        return '配置';
    }
  }

  /**
   * 获取报告目录路径
   */
  getReportsDirectory(): string {
    return this.reportsDir;
  }

  /**
   * 获取最近的报告列表
   */
  getRecentReports(limit: number = 10): string[] {
    try {
      const files = fs.readdirSync(this.reportsDir);
      return files
        .filter((file) => file.startsWith('import-report-') && file.endsWith('.json'))
        .sort((a, b) => {
          const aStats = fs.statSync(path.join(this.reportsDir, a));
          const bStats = fs.statSync(path.join(this.reportsDir, b));
          return bStats.mtime.getTime() - aStats.mtime.getTime();
        })
        .slice(0, limit)
        .map((file) => path.join(this.reportsDir, file));
    } catch (error) {
      logger.error('获取报告列表失败', error as Error);
      return [];
    }
  }
}
