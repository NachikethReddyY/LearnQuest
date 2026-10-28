import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import lesson from "./src/player/fixtures/lesson1.ts";
import type { AttemptResult, Hint, Reveal, StepPublic, StepState } from "./src/player/stepMachine.ts";

// shortcut: in-memory, single learner, no auth; replaced by apps/api (WP5) in Wk 3.
type Progress = { state: StepState; rungsTaken: number; attemptAllowed: boolean; retryAllowed: boolean };
const fresh = (): Progress => ({ state: "predicting", rungsTaken: 0, attemptAllowed: true, retryAllowed: false });
let progress = new Map<string, Progress>();
let attemptCounter = 0;

const prog = (id: string) => {
  if (!progress.has(id)) progress.set(id, fresh());
  return progress.get(id)!;
};

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const path = (req.url ?? "").split("?")[0].replace(/\/$/, "");
  const method = req.method;
  const bad = (error: string) => send(res, 400, { error });

  if (method === "POST" && path === "/__reset") {
    progress = new Map();
    return send(res, 200, { ok: true });
  }

  let m = path.match(/^\/lessons\/([^/]+)$/);
  if (m && method === "GET") {
    if (m[1] !== lesson.id) return send(res, 404, { error: "not found" });
    return send(res, 200, {
      id: lesson.id,
      title: lesson.title,
      steps: lesson.steps.map((s) => ({
        id: s.id,
        idx: s.idx,
        title: s.title,
        hintCount: s.hints.length,
        state: prog(s.id).state,
      })),
    });
  }

  m = path.match(/^\/steps\/([^/]+)(?:\/(attempts|hints|skip|reveal))?$/);
  const step = m && lesson.steps.find((s) => s.id === m![1]);
  if (!m || !step) return send(res, 404, { error: "not found" });
  const p = prog(step.id);
  const done = p.state === "revealed" || p.state === "skipped";
  const action = m[2];

  if (!action && method === "GET") {
    const hints: Hint[] = step.hints
      .slice(0, p.rungsTaken)
      .map((h, i) => ({ rung: i + 1, text: h.text, ...(h.eliminate !== undefined && { eliminate: h.eliminate }) }));
    const body: StepPublic = {
      id: step.id,
      idx: step.idx,
      title: step.title,
      prompt: step.prompt,
      kind: step.kind,
      ...(step.kind === "mcq" && { options: step.options }),
      hintCount: step.hints.length,
      state: p.state,
      rungsTaken: p.rungsTaken,
      attemptAllowed: p.attemptAllowed,
      hints,
      beforeFiles: step.input.beforeFiles,
    };
    return send(res, 200, body);
  }

  if (action === "attempts" && method === "POST") {
    let b: any;
    try {
      b = JSON.parse(await readBody(req));
    } catch {
      return bad("invalid JSON");
    }
    if (!b || b.kind !== step.kind) return bad(`kind must be ${step.kind}`);
    if (b.kind === "mcq" && !(Number.isInteger(b.choice) && b.choice >= 0 && b.choice <= 3)) {
      return bad("choice must be an integer 0-3");
    }
    if (b.kind === "cloze" && (typeof b.text !== "string" || b.text.length > 200)) {
      return bad("text must be a string of at most 200 chars");
    }
    if (done || (p.state === "hinting" && !p.attemptAllowed)) return send(res, 409, { error: "attempt not allowed" });
    const n = step.hints.length;
    const correct = step.kind === "mcq" ? b.choice === step.answer : step.accepted.includes(b.text.trim());
    if (correct) p.state = "revealed";
    else if (p.state === "predicting") {
      p.state = "hinting";
      p.attemptAllowed = false;
    } else if (p.retryAllowed) p.state = "revealed";
    else if (p.rungsTaken < n) p.attemptAllowed = false;
    else {
      p.retryAllowed = true;
      p.attemptAllowed = true;
    }
    const out: AttemptResult = {
      attemptId: String(++attemptCounter),
      correct,
      feedback: correct ? "Correct!" : "Not quite.",
      missedConcepts: [],
      hintsUsed: p.rungsTaken,
      state: p.state,
      attemptAllowed: p.attemptAllowed,
    };
    return send(res, 200, out);
  }

  if (action === "hints" && method === "POST") {
    if (done || p.rungsTaken >= step.hints.length) return send(res, 409, { error: "no hint available" });
    const h = step.hints[p.rungsTaken];
    p.rungsTaken++;
    p.state = "hinting";
    p.attemptAllowed = true;
    const out: Hint = { rung: p.rungsTaken, text: h.text, ...(h.eliminate !== undefined && { eliminate: h.eliminate }) };
    return send(res, 200, out);
  }

  if (action === "skip" && method === "POST") {
    if (done) return send(res, 409, { error: "already finished" });
    p.state = "skipped";
    return send(res, 200, { state: "skipped" });
  }

  if (action === "reveal" && method === "GET") {
    if (!done) return send(res, 409, { error: "not revealed yet" });
    const out: Reveal = {
      answer: step.kind === "mcq" ? { type: "mcq", index: step.answer } : { type: "cloze", text: step.answer },
      hunks: step.input.hunks,
      explanations: { ...step.explanations, inferred: true },
      source: lesson.source,
    };
    return send(res, 200, out);
  }

  return send(res, 404, { error: "not found" });
}

const handler = (req: IncomingMessage, res: ServerResponse) => {
  handle(req, res).catch(() => send(res, 500, { error: "server error" }));
};

export function mockApi(): Plugin {
  return {
    name: "mock-api",
    configureServer(server) {
      server.middlewares.use("/api", handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api", handler);
    },
  };
}
