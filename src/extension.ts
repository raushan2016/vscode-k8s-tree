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

	clusterExplorer.api.registerNodeContributor(
		clusterExplorer.api.nodeSources.groupingFolder("MIR", undefined,
		clusterExplorer.api.nodeSources.groupingFolder("Orchestrator", undefined,
			clusterExplorer.api.nodeSources.resourceFolder("ServiceEndpoint", "ServiceEndpoints", "ServiceEndpoint", "serviceendpoints", ),
			clusterExplorer.api.nodeSources.resourceFolder("ManagedInferenceresource", "ManagedInferenceresources","managedinferenceresource.orchestrator.mir.azureml.k8s.io", "managedinferenceresource.orchestrator.mir.azureml.k8s.io", ),
			clusterExplorer.api.nodeSources.resourceFolder("ModelSource", "ModelSources", "modelsource.orchestrator.mir.azureml.k8s.io", "modelsource.orchestrator.mir.azureml.k8s.io", ),
			clusterExplorer.api.nodeSources.resourceFolder("ModelService", "ModelServices", "modelservice.orchestrator.mir.azureml.k8s.io", "modelservice.orchestrator.mir.azureml.k8s.io")
	),
	clusterExplorer.api.nodeSources.groupingFolder("Instance", undefined,
	clusterExplorer.api.nodeSources.resourceFolder("ManagedInferenceresource", "ManagedInferenceresources", "ManagedInferenceresource.instance.mir.azureml.k8s.io", "managedinferenceresource.instance.mir.azureml.k8s.io", ),
	clusterExplorer.api.nodeSources.resourceFolder("ModelSource", "ModelSources", "ModelSource.instance.mir.azureml.k8s.io", "modelsource.instance.mir.azureml.k8s.io", ),
	clusterExplorer.api.nodeSources.resourceFolder("ModelService", "ModelServices", "ModelService.instance.mir.azureml.k8s.io", "modelservice.instance.mir.azureml.k8s.io")
	)
	).at(undefined));

let disposable = vscode.commands.registerCommand('vscode-k8s-tree.show',(resource)=>{
	treeView(resource);
});

context.subscriptions.push(disposable);
 //explorer.api.registerNodeContributor(new FileSystemNodeContributor(kubectl.api));

}

async function treeView(resource: any){
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
	
	const treeNode = clusterExplorer.api.resolveCommandTarget(resource);
	if(!treeNode || treeNode.nodeType !== 'resource'){
		vscode.window.showErrorMessage(`resource name not available.`);
		return		
	}
	const name = treeNode.name;
	const sr = await kubectl.api.invokeCommand('version');
	if (!sr || sr.code !== 0) {
		vscode.window.showErrorMessage(sr ? sr.stderr : 'oof');
		return;
	}
	vscode.window.showInformationMessage(sr.stdout);

	//const obj = await kubectl.api.invokeCommand(`tree -A ${treeNode.resourceKind.manifestKind} ${treeNode.name}`);
	const obj = await kubectl.api.invokeCommand(`tree --help`);
		if(!obj || obj.code != 0)
		{
			vscode.window.showErrorMessage(obj?.stderr ?? `Unable to get the resource ${treeNode.resourceKind}/${treeNode.name}`)
			return
		}

	vscode.window.showInformationMessage("tree view");
	// Create and show a new webview
	const panel = vscode.window.createWebviewPanel(
	 'catCoding', // Identifies the type of the webview. Used internally
	 `Tree View ${treeNode.resourceKind}/${treeNode.name}`, // Title of the panel displayed to the user
	 vscode.ViewColumn.One, // Editor column to show the new webview panel in.
	 {} // Webview options. More on these later.
	);
	   // And set its HTML contentg
	   panel.webview.html = getWebviewContent(name,obj.stdout);
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
	 <p>${treeNode}</p>
  </body>
  </html>`;
  }

// this method is called when your extension is deactivated
export function deactivate() {}
