import * as vscode from 'vscode';
import { ILogger } from './interfaces';

export class Logger implements ILogger {
  private outputChannel: vscode.OutputChannel;

  constructor(channelName: string = 'vscode-syncing') {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
  }

  info(message: string): void {
    const timestamp = new Date().toLocaleString();
    this.outputChannel.appendLine(`[INFO ${timestamp}] ${message}`);
  }

  warn(message: string): void {
    const timestamp = new Date().toLocaleString();
    this.outputChannel.appendLine(`[WARN ${timestamp}] ${message}`);
  }

  error(message: string, error?: Error): void {
    const timestamp = new Date().toLocaleString();
    const errorDetails = error ? ` - ${error.message}\n${error.stack}` : '';
    this.outputChannel.appendLine(`[ERROR ${timestamp}] ${message}${errorDetails}`);
  }

  debug(message: string): void {
    const timestamp = new Date().toLocaleString();
    this.outputChannel.appendLine(`[DEBUG ${timestamp}] ${message}`);
  }

  show(): void {
    this.outputChannel.show();
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

// 单例模式的全局日志器
export const logger = new Logger();
