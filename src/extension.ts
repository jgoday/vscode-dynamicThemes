'use strict';

import * as vscode from 'vscode';
import * as Path from 'path';
import { TextDocument, TextEditor } from 'vscode';
const mm = require('micromatch');

interface IState {
    workspaceName: string;
    theme?: string;
    fontFamily?: string;
}

interface IPattern {
    pattern: string;
    fontFamily?: string;
    theme?: string;
};

let states: IState[] = [];
let _patterns: IPattern[] = [];
let _pendingChanges: number = 0;

const restoreWorkspaceState = (_: vscode.WorkspaceConfiguration, globally?: boolean) =>
{
    if (states.length > 0)
    {
        const conf = vscode.workspace.getConfiguration();
        const workspaceState = states.find(s => s.workspaceName === vscode.workspace.name);

        if (workspaceState)
        {
            conf.update('editor.fontFamily', workspaceState.fontFamily, globally);
            conf.update('workbench.colorTheme', workspaceState.theme, globally);
        }
    }
};

const getCustomStyle = (filename: string) =>
{
    const st = _patterns.filter(p => mm.isMatch(filename, `**/${p.pattern}`));

    return st.length > 0 ? st[0] : null;
}

const fileHasCustomStyle = (filename: string) =>
{
    return getCustomStyle(filename) != null;
}

const setWorkspaceState = (editor: TextEditor) =>
{
    const fileName = editor.document.fileName;
    const changeGlobally = vscode.workspace && vscode.workspace.workspaceFolders
        ? vscode.workspace.workspaceFolders.length <= 0
        : true;
    const conf = vscode.workspace.getConfiguration();

    if (!states.find(s => s.workspaceName === vscode.workspace.name))
    {
        states.push({
            workspaceName: vscode.workspace.name,
            theme: conf.get('workbench.colorTheme'),
            fontFamily: conf.get('editor.fontFamily')
        });
    }

    const customStyle = getCustomStyle(fileName);
    if (customStyle)
    {
        if (customStyle.fontFamily
            && customStyle.fontFamily != conf.get('editor.fontFamily'))
        {
            _pendingChanges ++;
            conf.update('editor.fontFamily', customStyle.fontFamily, changeGlobally)
                .then(() => _pendingChanges--);
        }
        if (customStyle.theme
            && customStyle.fontFamily != conf.get('workbench.colorTheme'))
        {
            _pendingChanges ++;
            conf.update('workbench.colorTheme', customStyle.theme, changeGlobally)
                .then(() => _pendingChanges--);
        }
    }

    if (!customStyle)
    {
        restoreWorkspaceState(conf, changeGlobally);
    }
};

const onSettingsChanged = (_: vscode.ConfigurationChangeEvent) =>
{
    if (_pendingChanges <= 0)
    {
        const patterns = vscode.workspace.getConfiguration().get('dynamicThemes');
        _patterns = Object.keys(patterns).map(k =>
        {
            return { pattern: k, fontFamily: patterns[k].fontFamily, theme: patterns[k].theme };
        });

        // store new initial style
        const conf = vscode.workspace.getConfiguration();
        states = [];
        states.push({
            workspaceName: vscode.workspace.name,
            theme: conf.get('workbench.colorTheme'),
            fontFamily: conf.get('editor.fontFamily')
        });

        if (vscode.window.activeTextEditor
            && vscode.window.activeTextEditor.document
            && fileHasCustomStyle(vscode.window.activeTextEditor.document.fileName))
        {
            reloadCurrentDocument();
        }
    }
}

const reloadCurrentDocument = () =>
{
    if (vscode.window.activeTextEditor)
    {
        setWorkspaceState(vscode.window.activeTextEditor);
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext)
{
    if (vscode.workspace
        && vscode.workspace.getConfiguration())
    {
        const patterns = vscode.workspace.getConfiguration().get('dynamicThemes');

        _patterns = Object.keys(patterns || {}).map(k =>
        {
            return { pattern: k, fontFamily: patterns[k].fontFamily, theme: patterns[k].theme };
        });

        let changeDisposable = vscode.window.onDidChangeActiveTextEditor(setWorkspaceState);
        context.subscriptions.push(changeDisposable);
        let changeSettingsDisposable = vscode.workspace.onDidChangeConfiguration(onSettingsChanged);
        context.subscriptions.push(changeSettingsDisposable);
        context.subscriptions.push(new vscode.Disposable(() =>
        {
            const changeGlobally = vscode.workspace && vscode.workspace.workspaceFolders
            ? vscode.workspace.workspaceFolders.length <= 0
            : true;
    
            const conf = vscode.workspace.getConfiguration();
        
            restoreWorkspaceState(conf, changeGlobally);
        }));

        reloadCurrentDocument();
    }
}

// this method is called when your extension is deactivated
export function deactivate()
{
    // const changeGlobally = vscode.workspace && vscode.workspace.workspaceFolders
    //     ? vscode.workspace.workspaceFolders.length <= 0
    //     : true;

    // const conf = vscode.workspace.getConfiguration();

    // restoreWorkspaceState(conf, changeGlobally);
}