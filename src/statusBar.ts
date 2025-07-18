import * as vscode from 'vscode';

export class ReloadStatusBar {
    private item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.text = '$(debug-restart) Reload';
        this.item.tooltip = 'Reload VSCode Window';
        this.item.command = 'vscode-syncing.reloadWindow';
        this.item.show();
    }

    highlight() {
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        this.item.text = '$(alert) Reload Needed';
    }

    reset() {
        this.item.backgroundColor = undefined;
        this.item.text = '$(debug-restart) Reload';
    }

    dispose() {
        this.item.dispose();
    }
} 