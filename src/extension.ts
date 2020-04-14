// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { transcode } from 'buffer';

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

	let disposable = vscode.commands.registerCommand('vscode-k8s-tree.show', (resource) => {
		treeView(resource);
	});

	context.subscriptions.push(disposable);

}

async function treeView(resource: any) {

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

	const rootNode = clusterExplorer.api.resolveCommandTarget(resource);
	if (!rootNode || rootNode.nodeType !== 'resource') {
		vscode.window.showErrorMessage(`resource name not available.`);
		return;
	}

	const rootObjectName = rootNode.name;
	const rootObjectKind = rootNode.resourceKind.manifestKind;

	const commandResult = await kubectl.api.invokeCommand(`tree -A ${rootObjectKind} ${rootObjectName}`);

	if (!commandResult || commandResult.code !== 0) {
		if(commandResult?.stderr.includes("unknown command \"tree\" for \"kubectl\""))
		{
			vscode.window.showErrorMessage(`Make sure you have installed kubectl plugin \"tree\". Run \"kubectl krew install tree\", More details https://github.com/ahmetb/kubectl-tree`);
			return;
		}
		vscode.window.showErrorMessage(commandResult?.stderr ?? `Unable to get the resource ${rootObjectKind}/${rootObjectName}`);
		return;
	}

	// Create and show a new webview
	const panel = vscode.window.createWebviewPanel(
		'treeview', // Identifies the type of the webview. Used internally
		`Tree View ${rootObjectKind}/${rootObjectName}`, // Title of the panel displayed to the user
		vscode.ViewColumn.One, // Editor column to show the new webview panel in.
		{} // Webview options. More on these later.
	);
	// And set its HTML contentg
	panel.webview.html = getWebviewContent(rootObjectName, commandResult.stdout);
}

function getWebviewContent(name: string, treeNode: any) {
	return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Tree View</title>
  </head>
  <body>
	 <b>${name}</b>
	 <pre>${treeNode}</pre>
  </body>
  </html>`;
}

// this method is called when your extension is deactivated
export function deactivate() { }
