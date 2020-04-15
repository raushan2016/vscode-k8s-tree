'use strict';
import * as download from '../download/download';
import * as fs from 'fs';
import mkdirp = require('mkdirp');
import * as path from 'path';
import { Shell, Platform, getUseWsl } from './shell';
import { Errorable, failed } from './errorable';

enum ArchiveKind {
    Tar,
    Zip,
}

function platformUrlString(platform: Platform, supported?: Platform[]): string | null {
    if (supported && supported.indexOf(platform) < 0) {
        return null;
    }
    switch (platform) {
        case Platform.Windows: return 'windows';
        case Platform.MacOS: return 'darwin';
        case Platform.Linux: return 'linux';
        default: return null;
    }
}

export async function installKubectlTree(shell: Shell, installFolder : string): Promise<Errorable<null>> {
    const platform = shell.platform();
    const os = platformUrlString(platform);

    const version = "v0.4.0";
    const fileExtension = 'tar.gz';
    mkdirp.sync(installFolder);
    //https://github.com/ahmetb/kubectl-tree/releases/download/v0.4.0/kubectl-tree_v0.4.0_linux_amd64.tar.gz
    const downloadUrl = `https://github.com/ahmetb/kubectl-tree/releases/download/${version}/kubectl-tree_${version}_${os}_amd64.${fileExtension}`;
    const archiveKind = ArchiveKind.Tar;
    return await installFromArchive(downloadUrl, installFolder, shell, archiveKind);
}

export function getInstallFolder(shell: Shell, tool: string): string {
    return path.join(shell.home(), `.vs-kubernetes/tools/${tool}`);
}

async function installFromArchive(sourceUrl: string, destinationFolder: string, shell: Shell, archiveKind: ArchiveKind): Promise<Errorable<null>> {
    // download it
    const downloadResult = await download.toTempFile(sourceUrl);

    if (failed(downloadResult)) {
        return { succeeded: false, error: ['Failed to download: error was ' + downloadResult.error[0]] };
    }

    const archiveFile = downloadResult.result;

    // unarchive it
    const unarchiveResult = await unarchive(archiveFile, destinationFolder, shell, archiveKind);
    if (failed(unarchiveResult)) {
        return { succeeded: false, error: ['Failed to unpack: error was ' + unarchiveResult.error[0]] };
    }

    fs.unlinkSync(archiveFile);

    return { succeeded: true, result: null };
}

async function unarchive(sourceFile: string, destinationFolder: string, shell: Shell, archiveKind: ArchiveKind): Promise<Errorable<null>> {
        return await untar(sourceFile, destinationFolder, shell);
}

async function untar(sourceFile: string, destinationFolder: string, shell: Shell): Promise<Errorable<null>> {
    try {
        if (getUseWsl()) {
            const destination = destinationFolder.replace(/\\/g, '/');
            let result = await shell.exec(`mkdir -p ${destination}`);
            if (!result || result.code !== 0) {
                const message = result ? result.stderr : "Unable to run mkdir";
                console.log(message);
                throw new Error(`Error making directory: ${message}`);
            }
            const drive = sourceFile[0].toLowerCase();
            const filePath = sourceFile.substring(2).replace(/\\/g, '/');
            const fileName = `/mnt/${drive}/${filePath}`;
            const cmd = `tar -C ${destination} -xf ${fileName}`;
            result = await shell.exec(cmd);
            if (!result || result.code !== 0) {
                const message = result ? result.stderr : "Unable to run tar";
                console.log(message);
                throw new Error(`Error unpacking: ${message}`);
            }
            return { succeeded: true, result: null };
        }
        if (!fs.existsSync(destinationFolder)) {
            mkdirp.sync(destinationFolder);
        }
        const cmd = `tar -C ${destinationFolder} -xf ${sourceFile}`;
        let result = await shell.exec(cmd);
            if (!result || result.code !== 0) {
                const message = result ? result.stderr : "Unable to run tar";
                console.log(message);
                throw new Error(`Error unpacking: ${message}`);
            }
/*         await tar.x({
            cwd: destinationFolder,
            file: sourceFile
        }); */
        return { succeeded: true, result: null };
    } catch (e) {
        console.log(e);
        return { succeeded: false, error: [ "tar extract failed" ] /* TODO: extract error from exception */ };
    }
}