import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/editor/editor.worker?worker";
import tsWorker from "monaco-editor/language/typescript/ts.worker?worker";
import { loader } from "@monaco-editor/react";

// Bundled, no CDN. JS/TS modes need their own worker, or Monaco logs "Missing requestHandler" errors.
self.MonacoEnvironment = {
  getWorker: (_id, label) => (label === "typescript" || label === "javascript" ? new tsWorker() : new editorWorker()),
};
// The 0.57 typings only declare a deprecated stub for the TS namespace, hence the cast.
// Replay snippets are partial code, so squiggles would be noise.
const ts = (monaco as unknown as { typescript?: Record<string, { setDiagnosticsOptions(o: object): void }> }).typescript;
for (const d of ["javascriptDefaults", "typescriptDefaults"]) {
  ts?.[d]?.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true, noSuggestionDiagnostics: true });
}
loader.config({ monaco });
