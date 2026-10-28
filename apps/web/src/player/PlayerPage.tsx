import { useMemo, useRef, type KeyboardEvent } from "react";
import { buildTimeline } from "@learnquest/player-core";
import lesson from "./fixtures/lesson1";
import EditorPane, { type EditorHandle } from "./EditorPane";
import TransportBar from "./TransportBar";
import { stepIndexAt, useReplay } from "./useReplay";

const KEYS: [string, string][] = [
  ["Space / K", "Play or pause"],
  ["← / →", "Back / forward 5 seconds"],
  ["Shift + ← / →", "Previous / next step"],
  [", / .", "Slower / faster"],
  ["E", "Focus the code editor"],
  ["Esc", "Leave the editor"],
  ["?", "Show or hide this list"],
];

export default function PlayerPage() {
  const timeline = useMemo(() => buildTimeline(lesson.steps.map((s) => s.input)), []);
  const editorRef = useRef<EditorHandle>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const r = useReplay(timeline, (f) => editorRef.current?.show(f));

  const cur = stepIndexAt(timeline, r.t);
  const N = lesson.steps.length;

  const onKeyDown = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    // Keys belong to Monaco, form fields and the slider thumb (Radix handles arrows itself).
    if (e.ctrlKey || e.metaKey || e.altKey || el.closest(".monaco-editor, input, select, textarea, [role=slider]")) return;
    const onButton = el.tagName === "BUTTON"; // Space activates a focused button natively
    const k = e.key;
    if ((k === " " && !onButton) || k === "k" || k === "K") r.toggle();
    else if (k === "ArrowLeft") e.shiftKey ? r.stepBoundary(-1) : r.seekBy(-5000);
    else if (k === "ArrowRight") e.shiftKey ? r.stepBoundary(1) : r.seekBy(5000);
    else if (k === ",") r.slower();
    else if (k === ".") r.faster();
    else if (k === "e" || k === "E") editorRef.current?.focus();
    else if (k === "?") helpRef.current?.open ? helpRef.current.close() : helpRef.current?.showModal();
    else return;
    e.preventDefault();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6" onKeyDown={onKeyDown}>
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href="/" className="font-display text-2xl font-black">
          Learn<span className="text-blue">Quest</span>
        </a>
        <h1 className="font-display text-xl font-black">{lesson.title}</h1>
        <span className="rounded-full border-[3px] border-ink bg-lilac px-3 py-0.5 text-sm font-extrabold">
          Reconstructed replay
        </span>
        <span className="ml-auto text-sm font-extrabold">
          Step {cur + 1} / {N}
        </span>
      </header>

      <main className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <EditorPane ref={editorRef} transportRef={playRef} />

        <nav aria-label="Steps" className="chunk bg-white p-4">
          <ol className="flex flex-col gap-2">
            {lesson.steps.map((s, i) => (
              <li
                key={s.id}
                aria-current={i === cur ? "step" : undefined}
                className={`rounded-xl border-[3px] border-ink px-3 py-2 text-sm font-bold ${i === cur ? "bg-sun" : "bg-paper"}`}
              >
                <span className="font-extrabold">{i + 1}.</span> {s.title}
              </li>
            ))}
          </ol>
        </nav>

        <div className="chunk bg-white p-4 lg:col-span-2">
          <TransportBar
            timeline={timeline}
            titles={lesson.steps.map((s) => s.title)}
            t={r.t}
            playing={r.playing}
            speed={r.speed}
            playRef={playRef}
            onToggle={r.toggle}
            onSeek={r.seek}
            onSpeed={r.setSpeed}
          />
          <p className="mt-3 text-sm font-semibold text-ink/75">
            Press <kbd className="font-mono">?</kbd> for keyboard shortcuts.
          </p>
        </div>
      </main>

      <div role="status" aria-live="polite" className="sr-only">
        Step {cur + 1}: {lesson.steps[cur].title}
      </div>

      <dialog ref={helpRef} aria-labelledby="keys-h" className="chunk m-auto max-w-sm bg-paper p-5">
        <h2 id="keys-h" className="font-display text-xl font-black">
          Keyboard shortcuts
        </h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {KEYS.map(([k, d]) => (
            <div key={k} className="contents">
              <dt className="font-mono font-bold">{k}</dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          autoFocus
          className="pill mt-4 min-h-11 bg-sun px-4 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-blue"
          onClick={() => helpRef.current?.close()}
        >
          Close
        </button>
      </dialog>
    </div>
  );
}
