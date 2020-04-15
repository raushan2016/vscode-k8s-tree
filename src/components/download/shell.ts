'use strict';

import * as vscode from 'vscode';
import * as shelljs from 'shelljs';
import { getInstallFolder } from './install';
import { ChildProcess } from 'child_process';

export enum Platform {
    Windows,
    MacOS,
    Linux,
    Unsupported,  // shouldn't happen!
}

export interface ExecCallback extends shelljs.ExecCallback {}

export interface Shell {
    isWindows(): boolean;
    isUnix(): boolean;
    platform(): Platform;
    home(): string;
    combinePath(basePath: string, relativePath: string): string;
    fileUri(filePath: string): vscode.Uri;
    execOpts(): any;
    exec(cmd: string, kubeconfig?: string, stdin?: string): Promise<ShellResult | undefined>;
    execStreaming(cmd: string, callback: ((proc: ChildProcess) => void) | undefined): Promise<ShellResult | undefined>;
    execCore(cmd: string, opts: any, callback?: (proc: ChildProcess) => void, stdin?: string): Promise<ShellResult>;
    unquotedPath(path: string): string;
}

export const shell: Shell = {
    isWindows : isWindows,
    isUnix : isUnix,
    platform : platform,
    home : home,
    combinePath : combinePath,
    fileUri : fileUri,
    execOpts : execOpts,
    exec : exec,
    execStreaming: execStreaming,
    execCore : execCore,
    unquotedPath : unquotedPath,
};

const WINDOWS: string = 'win32';

export interface ShellResult {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

export type ShellHandler = (code: number, stdout: string, stderr: string) => void;


// Use WSL on Windows
const EXTENSION_CONFIG_KEY = "vs-kubernetes";
const USE_WSL_KEY = "use-wsl";

export function getUseWsl(): boolean {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)[USE_WSL_KEY];
}

function isWindows(): boolean {
    return (process.platform === WINDOWS) && !getUseWsl();
}

function isUnix(): boolean {
    return !isWindows();
}

function platform(): Platform {
    if (getUseWsl()) {
        return Platform.Linux;
    }
    switch (process.platform) {
        case 'win32': return Platform.Windows;
        case 'darwin': return Platform.MacOS;
        case 'linux': return Platform.Linux;
        default: return Platform.Unsupported;
    }
}

function concatIfSafe(homeDrive: string | undefined, homePath: string | undefined): string | undefined {
    if (homeDrive && homePath) {
        const safe = !homePath.toLowerCase().startsWith('\\windows\\system32');
        if (safe) {
            return homeDrive.concat(homePath);
        }
    }

    return undefined;
}

function home(): string {
    if (getUseWsl()) {
        return shelljs.exec('wsl.exe echo ${HOME}').stdout.trim();
    }
    return process.env['HOME'] ||
        concatIfSafe(process.env['HOMEDRIVE'], process.env['HOMEPATH']) ||
        process.env['USERPROFILE'] ||
        '';
}

function combinePath(basePath: string, relativePath: string) {
    let separator = '/';
    if (isWindows()) {
        relativePath = relativePath.replace(/\//g, '\\');
        separator = '\\';
    }
    return basePath + separator + relativePath;
}

function isWindowsFilePath(filePath: string) {
    return filePath[1] === ':' && filePath[2] === '\\';
}

function fileUri(filePath: string): vscode.Uri {
    if (isWindowsFilePath(filePath)) {
        return vscode.Uri.parse('file:///' + filePath.replace(/\\/g, '/'));
    }
    return vscode.Uri.parse('file://' + filePath);
}

function execOpts(): any {
    let env = process.env;
    if (isWindows()) {
        env = Object.assign({ }, env, { HOME: home() });
    }
    env = shellEnvironment(env);
    const opts = {
        cwd: vscode.workspace.rootPath,
        env: env,
        async: true
    };
    return opts;
}

async function exec(cmd: string, kubeconfig?: string, stdin?: string): Promise<ShellResult | undefined> {
    try {
        let execOpt = execOpts();
        if(kubeconfig){
            execOpt.env["KUBECONFIG"] = kubeconfig;
        }
        return await execCore(cmd, execOpt, null, stdin);
    } catch (ex) {
        vscode.window.showErrorMessage(ex);
        return undefined;
    }
}

async function execStreaming(cmd: string, callback: (proc: ChildProcess) => void): Promise<ShellResult | undefined> {
    try {
        return await execCore(cmd, execOpts(), callback);
    } catch (ex) {
        vscode.window.showErrorMessage(ex);
        return undefined;
    }
}

function execCore(cmd: string, opts: any, callback?: ((proc: ChildProcess) => void) | null, stdin?: string): Promise<ShellResult> {
    return new Promise<ShellResult>((resolve) => {
        if (getUseWsl()) {
            cmd = 'wsl ' + cmd;
        }
        const proc = shelljs.exec(cmd, opts, (code: any, stdout: any, stderr: any) => resolve({code : code, stdout : stdout, stderr : stderr}));
        if (stdin) {
            proc.stdin!.end(stdin);
        }
        if (callback) {
            callback(proc);
        }
    });
}

function unquotedPath(path: string): string {
    if (isWindows() && path && path.length > 1 && path.startsWith('"') && path.endsWith('"')) {
        return path.substring(1, path.length - 1);
    }
    return path;
}

export function shellEnvironment(baseEnvironment: any): any {
    const env = Object.assign({}, baseEnvironment);
    const pathVariable = pathVariableName(env);
    for (const tool of ['kubectl-tree']) {
        const toolDirectory = getInstallFolder(shell, tool);
        if (toolDirectory) {
            const currentPath = env[pathVariable];
            env[pathVariable] = toolDirectory + (currentPath ? `${pathEntrySeparator()}${currentPath}` : '');
        }
    }
    return env;
}

function pathVariableName(env: any): string {
    if (isWindows()) {
        for (const v of Object.keys(env)) {
            if (v.toLowerCase() === "path") {
                return v;
            }
        }
    }
    return "PATH";
}

function pathEntrySeparator() {
    return isWindows() ? ';' : ':';
}

export function shellMessage(sr: ShellResult | undefined, invocationFailureMessage: string): string {
    if (!sr) {
        return invocationFailureMessage;
    }
    return sr.code === 0 ? sr.stdout : sr.stderr;
}