import * as vscode from 'vscode';
import { logger } from './logger';

export enum ErrorType {
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  FILE_SYSTEM = 'FILE_SYSTEM',
  CONFIGURATION = 'CONFIGURATION',
  EXTENSION = 'EXTENSION',
  UNKNOWN = 'UNKNOWN',
}

export class SyncError extends Error {
  constructor(
    public readonly type: ErrorType,
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

export class ErrorHandler {
  static handle(error: Error | SyncError, context?: string): void {
    const contextMsg = context ? `[${context}] ` : '';

    if (error instanceof SyncError) {
      logger.error(`${contextMsg}${error.message}`, error.originalError);
      this.showUserMessage(error);
    } else {
      logger.error(`${contextMsg}未知错误: ${error.message}`, error);
      vscode.window.showErrorMessage(`发生未知错误: ${error.message}`);
    }
  }

  static async handleAsync<T>(operation: () => Promise<T>, context?: string): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      this.handle(error as Error, context);
      return null;
    }
  }

  static wrap<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: string,
  ): (...args: T) => Promise<R | null> {
    return async (...args: T) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error as Error, context);
        return null;
      }
    };
  }

  private static showUserMessage(error: SyncError): void {
    switch (error.type) {
      case ErrorType.VALIDATION:
        vscode.window.showWarningMessage(`配置验证失败: ${error.message}`);
        break;
      case ErrorType.NETWORK:
        vscode.window.showErrorMessage(`网络错误: ${error.message}`);
        break;
      case ErrorType.FILE_SYSTEM:
        vscode.window.showErrorMessage(`文件系统错误: ${error.message}`);
        break;
      case ErrorType.CONFIGURATION:
        vscode.window.showWarningMessage(`配置错误: ${error.message}`);
        break;
      case ErrorType.EXTENSION:
        vscode.window.showErrorMessage(`扩展操作失败: ${error.message}`);
        break;
      default:
        vscode.window.showErrorMessage(`操作失败: ${error.message}`);
    }
  }

  static createError(type: ErrorType, message: string, originalError?: Error): SyncError {
    return new SyncError(type, message, originalError);
  }
}
