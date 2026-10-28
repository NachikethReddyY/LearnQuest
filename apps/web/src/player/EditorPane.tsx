import { useImperativeHandle, useRef, useState, type Ref, type RefObject } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { SeekResult } from "@learnquest/player-core";
import "./monaco";

export type EditorHandle = { show(r: SeekResult): void; focus(): void };

const langOf = (p: string) => (/\.tsx?$/.test(p) ? "typescript" : /\.jsx?$/.test(p) ? "javascript" : "plaintext");

type Props = { ref: Ref<EditorHandle>; transportRef: RefObject<HTMLButtonElement | null> };

export default function EditorPane({ ref, transportRef }: Props) {
  const [paths, setPaths] = useState<string[]>([]);
  const [active, setActive] = useState("");
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const lastRef = useRef<SeekResult | null>(null);

  const apply = (r: SeekResult) => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return;
    const text = r.files[r.activePath] ?? "";
    if (model.getValue() !== text) model.setValue(text);
    if (r.lastEdit?.path === r.activePath) {
      const pos = model.getPositionAt(r.lastEdit.offset);
      ed.setPosition(pos);
      ed.revealPositionInCenterIfOutsideViewport(pos);
    }
  };

  useImperativeHandle(ref, () => ({
    show(r) {
      lastRef.current = r;
      const keys = Object.keys(r.files);
      setPaths((p) => (p.join() === keys.join() ? p : keys));
      setActive(r.activePath);
      apply(r);
    },
    focus: () => editorRef.current?.focus(),
  }));

  const onMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
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
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border-[3px] border-ink bg-white">
      <ul className="flex flex-wrap gap-1 border-b-[3px] border-ink bg-paper p-1.5 font-mono text-sm">
        {paths.map((p) => (
          <li
            key={p}
            aria-current={p === active ? "true" : undefined}
            className={`rounded-md px-3 py-1 ${p === active ? "bg-sun font-bold" : "text-ink/70"}`}
          >
            {p}
          </li>
        ))}
      </ul>
      <div className="h-80 lg:h-[26rem]">
        <Editor
          language={langOf(active)}
          theme="vs"
          onMount={onMount}
          options={{
            readOnly: true,
            ariaLabel: "Code replay, read only. Press Escape to leave the editor.",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            fontSize: 14,
            hover: { enabled: "off" },
            occurrencesHighlight: "off",
          }}
        />
      </div>
    </div>
  );
}
