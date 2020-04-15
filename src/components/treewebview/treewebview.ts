import * as vscode from 'vscode';
import { WebPanel } from '../webpanel/webpanel';
import { ShellResult } from '../../utils/utils';

export class TreeViewPanel extends WebPanel {
    public static readonly viewType = 'vscodeKubernetesTreeView';
    private static readonly describeContext = 'vscodeKubernetesTreeViewContext';
    private static activePanel: TreeViewPanel | undefined = undefined;
    public static currentPanels = new Map<string, TreeViewPanel>();

    public static refreshCommand() {
        if (TreeViewPanel.activePanel) {
            TreeViewPanel.activePanel.doRefresh();
        }
    }

    public static createOrShow(content: string, resource: string, refresh: () => Promise<ShellResult | undefined>) {
        const fn = (panel: vscode.WebviewPanel, content: string, resource: string): TreeViewPanel => {
            return new TreeViewPanel(panel, content, resource, refresh);
        };
        content = TreeViewPanel.beautifyHTML(content);
        WebPanel.createOrShowInternal<TreeViewPanel>(content, resource, TreeViewPanel.viewType, "Kubernetes TreeView", TreeViewPanel.currentPanels, fn);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        content: string,
        resource: string,
        private readonly refresh: () => Promise<ShellResult | undefined>
    ) {
        super(panel, content, resource, TreeViewPanel.currentPanels);

        const setActiveContext = (active: boolean) => {
            vscode.commands.executeCommand('setContext', TreeViewPanel.describeContext, active);
            TreeViewPanel.activePanel = active ? this : undefined;
        };

        this.panel.onDidChangeViewState((evt: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
            setActiveContext(evt.webviewPanel.active);
        });
        setActiveContext(true);
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'refresh':
                        await this.doRefresh();
                        break;
                }
            },
            undefined
        );
    }

    private async doRefresh() {
        const result = await this.refresh();
        if (!result) {
            vscode.window.showErrorMessage('Error refreshing!');
            return;
        }
        if (result.code !== 0) {
            vscode.window.showErrorMessage(`Error refreshing: ${result.stderr}`);
            return;
        }
        this.panel.webview.postMessage({
            command: 'content',
            content: TreeViewPanel.beautifyHTML(result.stdout),
        });
    }

    private static beautifyHTML(treeString: string): string{

        var lines = treeString.split(/[\r\n]+/);
        lines[0] = `<b>${lines[0]}</b>`;
        lines.forEach((element, index) => {
            if(element.includes("True")){
                lines[index] = element.fontcolor("forestgreen");
            }
            else if(element.includes("False")){
                lines[index] = element.fontcolor("tomato");
            }
        });
        return lines.join("<br>");
    }

    protected update() {
        this.panel.title = `Kubernetes treeview ${this.resource}`;
        this.panel.webview.html = `
    <!doctype html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Kubernetes Treeview ${this.resource}</title>
        <script>
            const vscode = acquireVsCodeApi();
            const requestRefresh = () => {
                vscode.postMessage({
                    command: 'refresh'
                });
            };
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'content':
                        const elt = document.getElementById('content');
                        elt.innerHTML = message.content;
                }
            });

            const automaticRefresh = () => {
                const val = 5;
                var startTime = new Date().getTime();
                var interval = setInterval(function(){
                    if(new Date().getTime() - startTime > 600000){
                        clearInterval(interval);
                        return;
                    }
                    requestRefresh();
                }, val * 1000);
            };
        </script>
    </head>
    <body>
        <div style="position: absolute; right: 90%">
          <a href="javascript:void;" onClick="requestRefresh();">Refresh</a>
        </div>
        <br/>
        <div>
           <code>
              <pre id='content' style="font-size: 100%">${this.content}</pre>
           </code>
        </div>
        <script>
            automaticRefresh();
        </script
    </body>
    </html>`;
    }
}