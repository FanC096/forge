import * as vscode from "vscode";
// eslint-disable-next-line no-unused-vars
import { LanguageClient, LanguageClientOptions } from "vscode-languageclient";
import * as com from "./commands";
import { withRacket } from "./utils";

let langClient: LanguageClient;
let isLangClientRunning: boolean = false;

export function deactivate() {
  if (!langClient) {
    return undefined;
  }
  return langClient.stop();
}

function setupLSP() {
  withRacket((racket: string) => {
    const executable = {
      command: racket,
      args: ["--lib", "racket-langserver"],
    };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions = {
      run: executable,
      debug: executable,
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      // Register the server for racket documents
      documentSelector: [{ scheme: "file", language: "racket" }],
      synchronize: {
        // Notify the server about file changes to '.clientrc files contained in the workspace
        fileEvents: vscode.workspace.createFileSystemWatcher("**/.clientrc"),
      },
      uriConverters: {
        code2Protocol: (uri) => uri.toString(true),
        protocol2Code: (str) => vscode.Uri.parse(str),
      },
    };

    // Create the language client and start the client.
    langClient = new LanguageClient(
      "forge",
      "Racket Language Client",
      serverOptions,
      clientOptions,
    );
  });
}

function reg(name: string, func: (...args: any[]) => any) {
  return vscode.commands.registerCommand(`forge.${name}`, func);
}

function configurationChanged() {
  const enableLSP: boolean = vscode.workspace
    .getConfiguration("forge.lsp")
    .get("enabled", true);

  if (langClient) {
    if (enableLSP && !isLangClientRunning) {
      langClient.start();
      isLangClientRunning = true;
    } else if (!enableLSP && isLangClientRunning) {
      langClient.stop();
      isLangClientRunning = false;
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  setupLSP();
  configurationChanged();

  // Each file has one output terminal and one repl
  // Those two are saved in terminals and repls, respectively
  // The file is _ran_ in the terminal and _loaded_ into a repl
  const terminals: Map<string, vscode.Terminal> = new Map();
  const repls: Map<string, vscode.Terminal> = new Map();

  vscode.workspace.onDidChangeConfiguration(configurationChanged);

  vscode.window.onDidCloseTerminal((terminal) => {
    terminals.forEach((val, key) => val === terminal && terminals.delete(key) && val.dispose());
    repls.forEach((val, key) => val === terminal && repls.delete(key) && val.dispose());
  });

  const loadInRepl = reg("loadFileInRepl", () => com.loadInRepl(repls));
  const runInTerminal = reg("runFile", () => com.runInTerminal(terminals));
  const executeSelection = reg("executeSelectionInRepl", () => com.executeSelection(repls));
  const openRepl = reg("openRepl", () => com.openRepl(repls));
  const showOutput = reg("showOutputTerminal", () => com.showOutput(terminals));

  context.subscriptions.push(loadInRepl, runInTerminal, executeSelection, openRepl, showOutput);
}
