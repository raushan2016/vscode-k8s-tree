// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { transcode } from 'buffer';
import { TreeViewPanel } from './components/treewebview/treewebview';
import { ShellResult } from './utils/utils';
import { shell } from './components/download/shell';
import { installKubectlTree, getInstallFolder } from './components/download/install';
import { failed} from './components/download/errorable';

const TOOL = 'kubectl-tree';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-k8s-tree" is now active!');

	const clusterExplorer = await k8s.extension.clusterExplorer.v1;
	if (!clusterExplorer.available) {
		vscode.window.showErrorMessage(`ClusterExplorer not available.`);
		return;
	}

	const kubectl = await k8s.extension.kubectl.v1;
	if (!kubectl.available) {
		vscode.window.showErrorMessage(`kubectl not available.`);
		return;
	}

	let disposable = vscode.commands.registerCommand('vscode-k8s-tree.show', renderTreeView);
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('vscode-k8s-tree.show.refresh', TreeViewPanel.refreshCommand),
	context.subscriptions.push(disposable);

}

 async function runkubectl(cmd: string):Promise<ShellResult | undefined> {
    const configuration = await k8s.extension.configuration.v1;
    if (!configuration.available) {
        return;
    }
    const path = await configuration.api.getKubeconfigPath();
    if (path.pathType === 'host') {
		return await shell.exec(`kubectl ${cmd}`, path.hostPath);
    } else if (path.pathType === 'wsl') {
		 return await shell.exec(`wsl kubectl ${cmd} --kubeconfig ${path.wslPath}`);
        // WSL-aware:
    } else {
        vscode.window.showErrorMessage('This command is not supported in your current configuration.');
    }
} 

async function renderTreeView(resourceNode?: any ) {// k8s.ClusterExplorerV1.ClusterExplorerResourceNode) {
	if (!resourceNode) {
		await vscode.window.showErrorMessage(`TreeView only works for resources, not with kinds`);
		return;
	}
	const kubectl = await k8s.extension.kubectl.v1;
	if (!kubectl.available) {
		vscode.window.showErrorMessage(`kubectl not available.`);
		return;
	}
	const rootObjectName = resourceNode.name;
	const rootObjectKind = resourceNode.kind.manifestKind;
	
	const cmd = `tree -A ${rootObjectKind} ${rootObjectName}`;
	const commandResult =  await runkubectl(cmd);
	//const commandResult = await kubectl.api.invokeCommand(cmd);

	const refresh = (): Promise<ShellResult | undefined> => {
		// return kubectl.api.invokeCommand(cmd);
		return runkubectl(cmd);
	};

	if (!commandResult || commandResult.code !== 0) {
		if(commandResult?.stderr.includes("unknown command \"tree\" for \"kubectl\""))
		{
			vscode.window.showInformationMessage(`kubectl plugin \"tree\" is missing, trying to install`);
			const installFolder = getInstallFolder(shell, TOOL);
			const result = await installKubectlTree(shell, TOOL, installFolder)
			if (failed(result)) {
				vscode.window.showErrorMessage(`Make sure you have installed kubectl plugin \"tree\". Run \"kubectl krew install tree\", More details https://github.com/ahmetb/kubectl-tree`);
			}
			vscode.window.showInformationMessage(`kubectl plugin \"tree\" is installed in the path [${installFolder}]. Make sure you add it in your global PATH for future.`);
			renderTreeView(resourceNode);
			return;
		}
		vscode.window.showErrorMessage(`Treeview failed: ${commandResult? commandResult.stderr : `Unable to get the resource ${rootObjectKind}/${rootObjectName}`}`);
		return;
	}

	TreeViewPanel.createOrShow(commandResult.stdout, `${rootObjectKind}/${rootObjectName}`, refresh);

}

// this method is called when your extension is deactivated
export function deactivate() { }
