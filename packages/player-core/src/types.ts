// shortcut: hand-written until packages/lesson-schema (WP2) exists; replace with its Zod types then.

/** Path → full file text. */
export type Files = Record<string, string>;

/** One unified-diff hunk. `lines` carry a ' ', '-' or '+' prefix; `oldStart` is 1-based in the step's beforeFiles. */
export type Hunk = { id: string; file: string; oldStart: number; lines: string[] };

/** What the client has for one revealed (or skipped) step: GET /steps/:id beforeFiles + GET /steps/:id/reveal hunks. */
export type StepInput = { beforeFiles: Files; hunks: Hunk[] };

export type TypingConfig = {
  msPerChar: number; // 60 WPM at 5 chars/word = 200
  lineEndPauseMs: number; // 300
  blockThresholdLines: number; // hunks with more changed lines than this insert as one block: 20
};

export type ReplayEvent =
  | { kind: "file"; path: string; t: number }
  | { kind: "insert"; path: string; offset: number; text: string; t: number }
  | { kind: "delete"; path: string; offset: number; length: number; t: number }
  | { kind: "block"; path: string; offset: number; deleteLength: number; text: string; t: number };

export type StepSpan = { idx: number; startEvent: number; endEvent: number; startT: number; endT: number };

export type Snapshot = { eventIndex: number; files: Files; activePath: string };

export type Timeline = {
  events: ReplayEvent[];
  snapshots: Snapshot[];
  steps: StepSpan[];
  duration: number; // ms at 1×
};

export type SeekResult = {
  files: Files;
  activePath: string;
  eventIndex: number; // events applied so far (exclusive)
  replayed: number; // events applied after the snapshot; must be ≤ K
  lastEdit: { path: string; offset: number } | null; // for cursor/highlight in the editor
};
