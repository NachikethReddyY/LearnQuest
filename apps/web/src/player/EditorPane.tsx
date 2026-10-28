import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref, type RefObject } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { SeekResult } from "@learnquest/player-core";
import "./monaco";

export type EditorHandle = { show(r: SeekResult): void; focus(): void };

const langOf = (p: string) => (/\.tsx?$/.test(p) ? "typescript" : /\.jsx?$/.test(p) ? "javascript" : "plaintext");

type Props = {
  ref: Ref<EditorHandle>;
  transportRef: RefObject<HTMLButtonElement | null>;
  viewPath?: string; // file the user picked; falls back to the replay's active file
  overlay?: ReactNode;
};

export default function EditorPane({ ref, transportRef, viewPath, overlay }: Props) {
  const [active, setActive] = useState("");
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const caretRef = useRef<ReturnType<Parameters<OnMount>[0]["createDecorationsCollection"]> | null>(null);
  const lastRef = useRef<SeekResult | null>(null);
  const viewRef = useRef(viewPath);

  const apply = useCallback((r: SeekResult) => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return;
    const shown = viewRef.current ?? r.activePath;
    const text = r.files[shown] ?? "";
    if (model.getValue() !== text) model.setValue(text);
    if (r.lastEdit?.path === shown) {
      const pos = model.getPositionAt(r.lastEdit.offset);
      ed.setPosition(pos);
      ed.revealPositionInCenterIfOutsideViewport(pos);
      const m = monacoRef.current;
      caretRef.current?.set(
        m
          ? [{ range: new m.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column), options: { beforeContentClassName: "lq-caret", showIfCollapsed: true } }]
          : [],
      );
    } else caretRef.current?.clear();
  }, []);

  useEffect(() => {
    viewRef.current = viewPath;
    if (lastRef.current) apply(lastRef.current);
  }, [viewPath, apply]);

  useImperativeHandle(ref, () => ({
    show(r) {
      lastRef.current = r;
      setActive(r.activePath);
      apply(r);
    },
    focus: () => editorRef.current?.focus(),
  }));

  const onMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    caretRef.current = ed.createDecorationsCollection();
    ed.addCommand(
      monaco.KeyCode.Escape,
      () => {
        (document.activeElement as HTMLElement | null)?.blur();
        transportRef.current?.focus();
      },
      "!findWidgetVisible",
    );
    if (lastRef.current) apply(lastRef.current);
  };

  return (
    <div className="relative h-[65dvh] min-w-0 flex-none lg:h-auto lg:min-h-0 lg:flex-1">
      <Editor
        language={langOf(viewPath ?? active)}
        theme="vs"
        onMount={onMount}
        options={{
          readOnly: true,
          ariaLabel: "Code replay, read only. Press Escape to leave the editor.",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fontSize: 14,
          padding: { bottom: 140 }, // room for the floating controls
          hover: { enabled: "off" },
          occurrencesHighlight: "off",
        }}
      />
      {overlay}
    </div>
  );
}
