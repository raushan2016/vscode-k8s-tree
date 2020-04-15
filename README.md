# vscode-k8s-tree README

* This extension is buid on top of `vscode-kubernetes-tools` add `Tree View` command to all kubernetes resource.  
* `Tree View` command gives a hierarchical view of kubernetes resources based on `OwnerReferences`

## Features

* The tree view automatically gets updated every 5 seconds for the next 10 minutes.  
* You can also use the `Refresh` link on the page or use shortcut `shift+ctrl+r` to force refresh.  

![Tree View IMG](assets/tree-view.PNG)

![Tree View](assets/tree-view.gif)

## Dependencies

- [VSCode Kubernetes Tools v1.1.0 or higher](https://github.com/Azure/vscode-kubernetes-tools/releases/tag/1.1.0) and [it's dependencies](https://github.com/Azure/vscode-kubernetes-tools#dependencies), installed and [configured](https://github.com/Azure/vscode-kubernetes-tools#extension-settings).

## Build

`npm install`   
`npm run vscode:prepublish`

## Publish package

`vsce package` Generate vsix file
`vsce publish patch` Publish the package with patch version upgrade


## Author

Raushan Kumar [@raushank2016](https://twitter.com/raushank2016).

**Special acknowledgement:** This tool internally uses [kubectl-tree](https://github.com/ahmetb/kubectl-tree)
