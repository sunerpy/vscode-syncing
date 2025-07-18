import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SnippetData, ExtensionInfo, ExtensionsExport, SettingsExport, ThemeInfo, ThemesExport } from './types/types';
import { getVSCodeEdition, getVSCodeDataDirectory, getVSCodeExtensionsDirectory, getPlatform } from './utils/vscodeEnvironment';
import { VSCodeEdition, Platform } from './types/vscodeEdition';

export class DataCollector {
    public readonly vscodeEdition: VSCodeEdition;
    public readonly platform: Platform;
    public readonly isPortable: boolean;
    public readonly dataDirectory: string;
    public readonly userDirectory: string;
    public readonly extensionsDirectory: string;
    public readonly userSettingsPath: string;
    public readonly userSnippetsPath: string;

    constructor(private outputChannel?: vscode.OutputChannel) {
        this.vscodeEdition = getVSCodeEdition();
        this.platform = getPlatform();
        this.isPortable = process.env.VSCODE_PORTABLE !== null;
        this.dataDirectory = getVSCodeDataDirectory();
        this.userDirectory = path.join(this.dataDirectory, "User");
        this.extensionsDirectory = getVSCodeExtensionsDirectory();
        this.userSettingsPath = path.join(this.userDirectory, "settings.json");
        this.userSnippetsPath = path.join(this.userDirectory, "snippets");

        if (this.outputChannel) {
            this.outputChannel.appendLine(`=== VSCode 环境信息 ===`);
            this.outputChannel.appendLine(`VSCode 发行版: ${this.vscodeEdition}`);
            this.outputChannel.appendLine(`操作系统平台: ${this.platform}`);
            this.outputChannel.appendLine(`便携模式: ${this.isPortable ? '是' : '否'}`);
            this.outputChannel.appendLine(`数据目录: ${this.dataDirectory}`);
            this.outputChannel.appendLine(`用户目录: ${this.userDirectory}`);
            this.outputChannel.appendLine(`扩展目录: ${this.extensionsDirectory}`);
            this.outputChannel.appendLine(`用户设置路径: ${this.userSettingsPath}`);
            this.outputChannel.appendLine(`用户代码片段路径: ${this.userSnippetsPath}`);
            this.outputChannel.appendLine(`vscode.env.appRoot: ${vscode.env.appRoot}`);
            this.outputChannel.appendLine(`vscode.env.appName: ${vscode.env.appName}`);
            
            // 添加 Remote-SSH 特定信息
            if (this.vscodeEdition === VSCodeEdition.REMOTE_SSH) {
                this.outputChannel.appendLine(`=== Remote-SSH 环境信息 ===`);
                this.outputChannel.appendLine(`VSCODE_AGENT_FOLDER: ${process.env['VSCODE_AGENT_FOLDER'] || '未设置'}`);
                this.outputChannel.appendLine(`VSCODE_SSH_HOST: ${process.env['VSCODE_SSH_HOST'] || '未设置'}`);
                this.outputChannel.appendLine(`REMOTE_SSH_EXTENSION: ${process.env['REMOTE_SSH_EXTENSION'] || '未设置'}`);
                this.outputChannel.appendLine(`Remote-SSH 扩展已安装: ${vscode.extensions.getExtension("ms-vscode-remote.remote-ssh") ? '是' : '否'}`);
                this.outputChannel.appendLine(`=== Remote-SSH 环境信息结束 ===`);
            }
            
            this.outputChannel.appendLine(`=== 环境信息结束 ===`);
        }
    }

    async getExtensions(): Promise<ExtensionsExport> {
        // 获取禁用扩展列表
        const userSettings = this.getUserSettings();
        let disabledList: string[] = [];
        if (userSettings && typeof userSettings === 'object' && userSettings['extensions.disabled']) {
            disabledList = Array.isArray(userSettings['extensions.disabled']) ? userSettings['extensions.disabled'] : [];
        }
        const extensions = vscode.extensions.all
            .filter(ext => !ext.packageJSON.isBuiltin)
            .map(ext => ({
                id: ext.id,
                name: ext.packageJSON.displayName || ext.packageJSON.name,
                version: ext.packageJSON.version,
                publisher: ext.packageJSON.publisher,
                description: ext.packageJSON.description,
                isActive: ext.isActive,
                enabled: !disabledList.includes(ext.id)
            }));

        return {
            count: extensions.length,
            list: extensions
        };
    }

    async getSettings(): Promise<SettingsExport> {
        const config = vscode.workspace.getConfiguration();
        const settings: SettingsExport = {};

        // 获取用户设置
        const userSettings = this.getUserSettings();
        if (userSettings) {
            settings.user = userSettings;
        }

        // 获取工作区设置
        const workspaceSettings = this.getWorkspaceSettings();
        if (workspaceSettings) {
            settings.workspace = workspaceSettings;
        }

        return settings;
    }

    async getThemes(): Promise<ThemesExport> {
        const config = vscode.workspace.getConfiguration();
        const colorTheme = config.get('workbench.colorTheme');
        const iconTheme = config.get('workbench.iconTheme');
        const productIconTheme = config.get('workbench.productIconTheme');

        // 获取已安装的主题扩展
        const themeExtensions = vscode.extensions.all
            .filter(ext => {
                const contributes = ext.packageJSON.contributes;
                return contributes && (
                    contributes.themes || 
                    contributes.iconThemes || 
                    contributes.productIconThemes
                );
            })
            .map(ext => ({
                id: ext.id,
                name: ext.packageJSON.displayName || ext.packageJSON.name,
                themes: ext.packageJSON.contributes?.themes || [],
                iconThemes: ext.packageJSON.contributes?.iconThemes || [],
                productIconThemes: ext.packageJSON.contributes?.productIconThemes || []
            }));

        return {
            current: {
                colorTheme: colorTheme as string | undefined,
                iconTheme: iconTheme as string | undefined,
                productIconTheme: productIconTheme as string | undefined
            },
            available: themeExtensions
        };
    }

    async getSnippets(): Promise<{[key: string]: SnippetData}> {
        const snippets: {[key: string]: SnippetData} = {};
        
        try {
            // 获取用户代码片段目录
            const userSnippetsPath = this.getUserSnippetsPath();
            if (this.outputChannel) {
                this.outputChannel.appendLine(`User snippets path: ${userSnippetsPath}`);
            }
            if (fs.existsSync(userSnippetsPath)) {
                const files = fs.readdirSync(userSnippetsPath);
                for (const file of files) {
                    if (file.endsWith('.code-snippets') || file.endsWith('.json')) {
                        const filePath = path.join(userSnippetsPath, file);
                        try {
                            const content = fs.readFileSync(filePath, 'utf8');
                            const ext = file.endsWith('.code-snippets') ? '.code-snippets' : '.json';
                            const language = path.basename(file, ext);
                            snippets[language] = { content, ext };
                        } catch (error) {
                            if (this.outputChannel) {
                                this.outputChannel.appendLine(`Failed to read snippet file ${file}: ${error}`);
                            }
                        }
                    }
                }
            }

            // 获取工作区代码片段
            if (vscode.workspace.workspaceFolders) {
                for (const folder of vscode.workspace.workspaceFolders) {
                    const workspaceSnippetsPath = path.join(folder.uri.fsPath, '.vscode', 'snippets');
                    if (fs.existsSync(workspaceSnippetsPath)) {
                        const files = fs.readdirSync(workspaceSnippetsPath);
                        for (const file of files) {
                            if (file.endsWith('.code-snippets') || file.endsWith('.json')) {
                                const filePath = path.join(workspaceSnippetsPath, file);
                                try {
                                    const content = fs.readFileSync(filePath, 'utf8');
                                    const ext = file.endsWith('.code-snippets') ? '.code-snippets' : '.json';
                                    const language = `workspace-${path.basename(file, ext)}`;
                                    snippets[language] = { content, ext };
                                } catch (error) {
                                    if (this.outputChannel) {
                                        this.outputChannel.appendLine(`Failed to read workspace snippet file ${file}: ${error}`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            if (this.outputChannel) {
                this.outputChannel.appendLine(`Failed to collect snippets: ${error}`);
            }
        }

        return snippets;
    }

    private getUserSettings(): Record<string, unknown> | null {
        try {
            const settingsPath = this.getUserSettingsPath();
            if (fs.existsSync(settingsPath)) {
                const content = fs.readFileSync(settingsPath, 'utf8');
                return JSON.parse(content);
            }
        } catch (error) {
            if (this.outputChannel) {
                this.outputChannel.appendLine(`Failed to read user settings: ${error}`);
            }
        }
        return null;
    }

    private getWorkspaceSettings(): Record<string, unknown> | null {
        try {
            if (vscode.workspace.workspaceFolders) {
                const workspaceFolder = vscode.workspace.workspaceFolders[0];
                const settingsPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'settings.json');
                if (fs.existsSync(settingsPath)) {
                    const content = fs.readFileSync(settingsPath, 'utf8');
                    return JSON.parse(content);
                }
            }
        } catch (error) {
            if (this.outputChannel) {
                this.outputChannel.appendLine(`Failed to read workspace settings: ${error}`);
            }
        }
        return null;
    }

    public getUserSettingsPath(): string {
        return this.userSettingsPath;
    }

    public getUserSnippetsPath(): string {
        return this.userSnippetsPath;
    }
}