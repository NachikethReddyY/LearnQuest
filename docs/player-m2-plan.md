# WP4-M2: Player state machine, gate, reveal, narration — implementation plan

Written for Sonnet and Haiku to execute task by task. Each task lists its model, files, exact behaviour and a "done when" check. Do tasks in order unless marked parallel. Do not add features that are not listed here.

Source of truth: `docs/plan.md` §5 (state diagram, lines 112–124), §8 (narration, line 227), §9 API (lines 285–299), §12 (leak honesty, line 410), §15.11 (UX/keyboard, line 494).

---

## 0. Facts the implementer must know first

1. **There is no API yet.** `apps/api/src/*` is empty (`.gitkeep`). WP5 builds it in Wk 3. Until then we serve the §9 endpoints from a **Vite dev/preview middleware mock** (Task 1). The client code calls `/api/...` exactly as it will call the real API, so swapping later is a no-op.
2. **Today the client bundle leaks every answer.** `PlayerPage.tsx` imports `fixtures/lesson1.ts`, which contains all hunks. The leak test (Task 8) would fail on day one. After this work, **`PlayerPage` and everything it imports must not import `fixtures/lesson1.ts`.** Only `DiffPage.tsx` (the S2b control arm, which shows full diffs by design) and the mock server may import it.
3. **`useReplay.ts` stays playback-only.** Don't put gate logic in it. The new layer sits above it and only hands it a new `timeline`.
4. Replay is now **per step**: before reveal the timeline is `buildTimeline([{ beforeFiles, hunks: [] }])` (duration 0, shows the before-code). After reveal it is `buildTimeline([{ beforeFiles, hunks }])` and plays. `buildTimeline` already handles empty hunks.
5. Unit tests in this repo use `node --test` on `.ts` files (see `packages/player-core/package.json`). Node 22+ strips types. Files tested this way must import local files **with the `.ts` extension** (tsconfig already has `allowImportingTsExtensions`).
6. Existing helpers to reuse: `FOCUS` (focus ring) in `player/ui.ts`; `Window` component; `.pill` / `.chunk` CSS classes; colour tokens `bg-sun`, `bg-mint`, `bg-green`, `bg-paper`, `border-ink`. Look at `PlayerPage.tsx` dialogs for button styling.

## 1. Decisions (made here, change only if the owner says so)

- **D1 — `browse` state** = "loading this step and resuming". On entering a step the client fetches `GET /api/steps/:id`, then jumps to the server's state (`predicting`, `hinting`, `revealed`, `skipped`). It is also where a 409 sends us to re-sync. This matches §5's client `loading → ready`.
- **D2 — attempt allowed after the first miss is `false`.** §5 says a miss with rungs left needs a new rung; we apply that to the first miss too (otherwise learners brute-force MCQ). Only `POST /hints` sets it back to `true`. After the last rung, a miss sets `retry_allowed` (one more try, `attemptAllowed=true`); a miss after that auto-reveals.
- **D3 — the server tells the client `attemptAllowed`.** Add `attemptAllowed: boolean` to the attempt response and the step response, and `rungsTaken` + already-taken `hints[]` to the step response (for resume). The client never re-derives the rules. *Note for WP5: this adds three fields to the §9 contract.*
- **D4 — captions/narration text = `explanations.workedExample`.** No new schema field.
- **D5 — the step panel shows in both modes.** The gate is "never cut" (§11), so video mode now also gets the Instructions window (renamed "Step"). Pass `true` for the `task` arg of `useWindows` layout; keep `MODE` only for the code window's label/icon.
- **D6 — XState v5** for the machine (§5 and §6.2 name it). The machine is **pure**: no fetches inside it. A hook does I/O and sends events. That keeps it testable with `node --test`.

---

## 2. API contract (mock now, WP5 later)

All under `/api`. JSON. Lesson id `lesson-1`, step ids `s1`, `s2`, `s3`.

| Method + path | Response |
|---|---|
| `GET /api/lessons/:id` | `{ id, title, steps: [{ id, idx, title, hintCount, state }] }` — no prompts, no files |
| `GET /api/steps/:id` | `{ id, idx, title, prompt, kind: "mcq"\|"cloze", options?: string[4], hintCount, state, rungsTaken, attemptAllowed, hints: [{ rung, text, eliminate? }], beforeFiles }` |
| `POST /api/steps/:id/attempts` body `{kind:"mcq", choice:0..3}` or `{kind:"cloze", text}` (≤200 chars) | `200 { attemptId, correct, feedback, missedConcepts: [], hintsUsed, state, attemptAllowed }` · `409 {error}` if state is `revealed`/`skipped`, or `hinting` with `attemptAllowed=false` · `400` on bad body |
| `POST /api/steps/:id/hints` | `200 { rung, text, eliminate? }` (`eliminate` only for MCQ rung 1, never the answer) · `409` if all rungs used or state is `revealed`/`skipped` |
| `POST /api/steps/:id/skip` | `200 { state: "skipped" }` · `409` if already `revealed`/`skipped` |
| `GET /api/steps/:id/reveal` | `200 { answer: {type:"mcq", index} \| {type:"cloze", text}, hunks, explanations: { workedExample, practice, inferred: true }, source: { repo, sha, path } }` · `409` unless `revealed`/`skipped` |
| `POST /api/__reset` | mock only: clears all progress. Used by e2e `beforeEach`. |

`feedback` on a miss is a fixed string ("Not quite."). It must never contain the answer.

**Server rules (state per step, start `{state:"predicting", rungsTaken:0, attemptAllowed:true, retryAllowed:false, observed:false}`):**
- attempt in `predicting`: correct → `revealed`. wrong → `hinting`, `attemptAllowed=false`. First attempt sets `observed=true`.
- hint: needs `rungsTaken < hintCount`; `rungsTaken++`, `state="hinting"`, `attemptAllowed=true`.
- attempt in `hinting` (must have `attemptAllowed`): correct → `revealed`. wrong and `retryAllowed` → `revealed` (auto-reveal). wrong and `rungsTaken < hintCount` → `attemptAllowed=false`. wrong and `rungsTaken === hintCount` → `retryAllowed=true`, `attemptAllowed=true`.
- skip in `predicting`/`hinting` → `skipped`.
- grading: MCQ by index; cloze by `accepted.includes(text.trim())`.

---

## Task 1a — Lesson 1 secret content · **Haiku**

**File:** `apps/web/src/player/fixtures/lesson1.ts` (edit; keep `beforeFiles`, `hunks`, ids, titles as they are).

Add to each step: `prompt`, `kind`, `options` (MCQ only), `answer`, `accepted` (cloze only), `hints` (`{text, eliminate?}[]`), `explanations: { workedExample, practice }`. Move the existing `summary` text into `explanations.workedExample` and delete `summary`. Add lesson-level `source: { repo: "NachikethReddyY/LearnQuest", sha: <full sha of commit c01e679, from `git rev-parse c01e679`>, path: "apps/web/src/player/fixtures/lesson1.ts" }`.

Use exactly this content (options are prose on purpose — an option must never equal a hunk line, or the leak test fails):

- **s1** · mcq · prompt: "cartTotal(cart) is added next. How will it add up the prices?" · options: ["A for loop that pushes each price into a new array", "reduce, with the sum starting at 0", "reduce, with no starting value", "Math.max over the prices"] · answer 1 · hints: [{text: "Look at addItem: this file prefers array methods to loops.", eliminate: 3}, {text: "An empty cart must total 0, not throw an error."}] · practice: "Write cartCount(cart) that returns how many items are in the cart, using reduce."
- **s2** · cloze · prompt: "cartTotal gets a second, optional parameter for a discount. Type that parameter exactly as it will appear in the signature." · accepted: ["discount = 0", "discount=0"] · answer text "discount = 0" · hints: [{text: "Old callers pass only the cart, so the parameter must be optional."}, {text: "Give it a default value that means no discount at all."}] · practice: "Add an optional taxRate parameter that defaults to no tax."
- **s3** · mcq · prompt: "The test adds a check for a 50% discount on items priced 10 and 5. What value will it assert?" · options: ["15", "7.5", "5", "2.5"] · answer 1 · hints: [{text: "Work out the plain total first.", eliminate: 0}, {text: "Then multiply it by (1 - 0.5)."}] · practice: "Add an assertion for a 20% discount on the same items."

Also export a helper used by the e2e leak test:
```ts
/** Strings that must not reach the browser before step `id` is revealed. */
export function secretsOf(id: string): string[]
```
Return: every `+` hunk line of that step with the `+` removed, trimmed, kept only if length ≥ 8; `accepted` strings; `workedExample`; `practice`; `source.sha`. (Don't include MCQ options — they are public.)

**Check DiffPage still compiles** (it reads `lesson.steps[].input` and `title`; it may have read `summary` — if so, switch it to `explanations.workedExample`).

**Done when:** `pnpm --filter @learnquest/web lint` passes.

## Task 1b — Mock API as a Vite plugin · **Sonnet** (after 1a)

**New file:** `apps/web/mock-api.ts`. **Edit:** `apps/web/vite.config.ts` to add the plugin; add `"mock-api.ts"` to `tsconfig.json` `include`.

- Export `mockApi(): Plugin` with both `configureServer` and `configurePreviewServer` hooks that do `server.middlewares.use("/api", handler)`. Preview matters: the e2e suite runs against the production build.
- Import the fixture from `./src/player/fixtures/lesson1.ts`. This runs in Node only; it does not enter the client bundle.
- In-memory `Map<stepId, Progress>`; implement §2 rules exactly. Read JSON bodies with a small `await new Promise` over `req.on("data")`. Validate bodies (bad JSON, wrong `kind`, `choice` out of 0–3, cloze text > 200 chars → `400`).
- Unknown route → `404`.
- `// shortcut: in-memory, single learner, no auth; replaced by apps/api (WP5) in Wk 3.`

**Done when:** with `pnpm --filter @learnquest/web dev` running, these curl calls behave:
```
curl -s localhost:5173/api/steps/s1 | jq .state            # "predicting"
curl -s -XPOST localhost:5173/api/steps/s1/attempts -H 'content-type: application/json' -d '{"kind":"mcq","choice":0}'  # correct:false, attemptAllowed:false
curl -s -o /dev/null -w '%{http_code}' -XPOST localhost:5173/api/steps/s1/attempts -H 'content-type: application/json' -d '{"kind":"mcq","choice":1}'  # 409
curl -s -XPOST localhost:5173/api/steps/s1/hints           # rung 1, eliminate 3
curl -s -o /dev/null -w '%{http_code}' localhost:5173/api/steps/s2/reveal   # 409
```

## Task 2 — State machine + unit tests · **Sonnet** (parallel with 1a/1b)

**Install:** `pnpm --filter @learnquest/web add xstate @xstate/react`.
**New files:** `apps/web/src/player/stepMachine.ts`, `apps/web/src/player/stepMachine.test.ts`. **Edit:** `apps/web/package.json` add `"test": "node --test 'src/**/*.test.ts'"`.

`stepMachine.ts` imports only `xstate` (no React, no local files). Types live in this file and are exported (`StepPublic`, `Hint`, `Reveal`, `AttemptResult`).

```
context: { lessonSteps: number, idx: number, step: StepPublic | null, hints: Hint[],
           attemptAllowed: boolean, feedback: string | null, lastCorrect: boolean | null,
           reveal: Reveal | null, notice: string | null }

browse     ── LOADED{step}           → by step.state: predicting | hinting | revealed | skipped
                                        (copy hints, attemptAllowed from step)
predicting ── RESULT{r}              → r.state === "revealed" ? revealed : hinting   (store feedback, lastCorrect, attemptAllowed)
           ── HINT{hint}             → hinting (append hint, attemptAllowed = true)
           ── SKIPPED                → skipped
           ── CONFLICT{msg}          → browse (notice = msg)
hinting    ── RESULT{r}              → r.state === "revealed" ? revealed : hinting
           ── HINT{hint}             → hinting (append, attemptAllowed = true)
           ── SKIPPED                → skipped
           ── CONFLICT{msg}          → browse
revealed   ── REVEAL_LOADED{reveal}  → (stay, store reveal)
skipped    ── REVEAL_LOADED{reveal}  → (stay, store reveal)
revealed|skipped ── NEXT             → idx + 1 < lessonSteps ? browse (idx++, reset step context) : finished
finished   (final)
```
Export three selectors (plain functions of a snapshot) so UI and keyboard share one rule:
`canSubmit(s)` = `predicting` or (`hinting` and `attemptAllowed`); `canHint(s)` = (`predicting`|`hinting`) and `hints.length < step.hintCount`; `canSkip(s)` = `predicting`|`hinting`.

Machine input: `{ lessonSteps: number, idx?: number }`.

**Tests** (`node:test` + `createActor`): one test per arrow above, plus: `canSubmit` false after a wrong RESULT with `attemptAllowed:false`, true again after HINT; NEXT on last step → `finished`; CONFLICT → `browse` with notice.

**Done when:** `pnpm --filter @learnquest/web test` passes.

## Task 3 — API client + `useStepFlow` hook · **Sonnet** (after 1b, 2)

**New files:** `apps/web/src/player/api.ts`, `apps/web/src/player/useStepFlow.ts`.

`api.ts`: one `call<T>(method, path, body?)` using `fetch` with `credentials: "same-origin"`; throws `ApiError { status }` on non-2xx. Typed wrappers: `getLesson`, `getStep`, `attempt`, `hint`, `skip`, `reveal`. Nothing else.

`useStepFlow(lessonId)`:
- `getLesson` once → `useMachine(stepMachine, { input: { lessonSteps } })`. While the lesson loads, render a loading status.
- On entering `browse`: `getStep(steps[idx].id)` → `LOADED`.
- On entering `revealed` or `skipped`: `reveal(id)` → `REVEAL_LOADED`. **This is the only place hunks/answers are fetched.**
- `submit(answer)`, `takeHint()`, `doSkip()`, `next()`: guard with the selectors, call the API, send the event. On `ApiError` 409 send `CONFLICT` with a learner message (`"Take the next hint before trying again."` when in `hinting`, else `"This step has already been answered."`). Other errors: set `notice` to `"Something went wrong. Try again."` and stay.
- Returns `{ snapshot, lesson, submit, takeHint, doSkip, next, canSubmit, canHint, canSkip }`.

**Done when:** lint passes; manual check in Task 4.

## Task 4 — Panels + PlayerPage wiring · **Sonnet** (after 3)

**New:** `apps/web/src/player/PredictPanel.tsx`, `apps/web/src/player/RevealPanel.tsx`. **Edit:** `PlayerPage.tsx`, `useWindows.ts` (only if D5 needs it).

`PlayerPage.tsx`:
- **Remove the `fixtures/lesson1` import.** Title, step list and progress dots come from `getLesson` via `useStepFlow`.
- Timeline: `useMemo` → `buildTimeline([{ beforeFiles: step.beforeFiles, hunks: reveal?.hunks ?? [] }])`. Before the step loads, pass an empty timeline (`buildTimeline([{beforeFiles:{}, hunks:[]}])`).
- **Replay plays on reveal:** when `reveal` goes from null to set, call `r.play()` (useReplay already maps reduced-motion to `instant`, which jumps to the end — that is the reduced-motion behaviour, keep it).
- D5: the Instructions window (label "Step") always renders. Its body: step title, `"Step i of N"`, then `<PredictPanel>` in `predicting`/`hinting`, `<RevealPanel>` in `revealed`/`skipped`, a finish card in `finished` (`"Lesson complete"` + link to `/`), a `role="status"` "Loading step…" in `browse`.
- Step list nav: keep it, but buttons are disabled (not just styled) for steps after the current one. Clicking an earlier step is out of scope — make earlier steps non-interactive too (`aria-current` stays on the current one).

`PredictPanel` (props: step, hints, feedback, notice, canSubmit, canHint, canSkip, onSubmit, onHint, onSkip):
- A `<form>` with `<fieldset><legend>{prompt}</legend>`. MCQ: four radio inputs with labels; an option index equal to any `hint.eliminate` is `disabled` and rendered with `line-through` plus sr-only "(ruled out)". Cloze: one `<input type="text" maxLength={200}>` with a visible label.
- Buttons: **Submit** (`type="submit"`, `disabled={!canSubmit || nothing chosen}`), **Hint** (`"Hint (1 of 2)"` style label, `disabled={!canHint}`), **Skip** (`disabled={!canSkip}`).
- When `!canSubmit` in `hinting`, show under Submit: `"Take a hint to try again."` and connect it with `aria-describedby` on the Submit button.
- Feedback (`"Not quite."`) and `notice` render in one `role="status"` element.
- Hints render as an `<ol aria-label="Hints">`; each `<li tabIndex={-1}>`.

`RevealPanel` (props: state, lastCorrect, step, reveal, onNext, isLast):
- Heading (`tabIndex={-1}`): `"Correct!"` / `"Here's the answer"` (revealed after a miss) / `"Skipped — here's the answer"`.
- The answer: MCQ → the option text; cloze → `<code>{text}</code>`.
- `workedExample` paragraph, `"Try it: " + practice`, a small label `"Explanation inferred from the diff"` (because `inferred: true`, see §12).
- Source link: `https://github.com/${repo}/blob/${sha}/${path}`, text `"View source on GitHub"`, `target="_blank" rel="noreferrer"`.
- **Next step** button (`"Finish lesson"` if last) → `onNext`. While `reveal` is null show "Loading answer…" status.
- Captions slot (filled in Task 5).

**Bundle check:** today Rolldown puts the fixture into the shared `monaco-*.js` chunk, because both `PlayerPage` and `DiffPage` import it and Monaco. After removing the import, run `pnpm --filter @learnquest/web build && grep -l "discount = 0" dist/assets/*.js`. Only a `DiffPage-*` chunk may match. If the shared chunk still matches, change `DiffPage.tsx` to load the fixture with a dynamic `import()` so it gets its own chunk.

**Done when:** in the browser at `/play`: choose a wrong option → feedback, Submit disabled with the hint text; Hint → rung shows, an option is struck through, Submit enabled; right option → reveal panel, replay types the change; Next → step 2 loads. Lint passes.

## Task 5 — Narration with fallback + captions · **Haiku** (after 4; parallel with 6)

**New:** `apps/web/src/player/useNarration.ts`. **Edit:** `RevealPanel.tsx`, `PlayerPage.tsx`.

```ts
useNarration({ lessonId, stepId, text, active, volume, muted }): { caption: string | null }
```
- Does nothing until `active` is true. `active = (state is revealed or skipped) && reveal !== null`. **No `Audio` object is created and no `/audio/` URL is touched before that** (leak rule §12).
- When active: `const a = new Audio(`/audio/${lessonId}/${stepId}.mp3`)`; `a.volume = muted ? 0 : volume / 100`; `a.play()`. On `a.onerror` **or** a rejected `play()` that is not an `AbortError`/`NotAllowedError`: fall back to `speechSynthesis.speak(new SpeechSynthesisUtterance(text))` (skip if `muted` or `!("speechSynthesis" in window)`). `onerror` covers both a 404 and the dev server returning HTML.
- Cleanup on step change/unmount: `a.pause()`, `a.src = ""`, `speechSynthesis.cancel()`.
- Volume/mute changes while playing update `a.volume` (and cancel speech when muted).
- `caption` = `text` while active, else null. Caption text is always shown when narration is active, even if muted or speech is unavailable.
- `PlayerPage`: remove the "Drives narration audio once it lands" comment; pass `vol`.
- `RevealPanel`: render the caption in a `<p>` under a small `"Captions"` heading with `aria-live="off"` (the text is already visible; don't make screen readers read it twice over the speech).

`apps/web/public/audio/lesson-1/` stays empty for now (WP11 renders MP3s), so the fallback path is what runs today.

**Done when:** on reveal, the browser speaks the worked example and the caption shows; DevTools network shows `/audio/lesson-1/s1.mp3` only after reveal.

## Task 6 — Keyboard, focus, reduced motion · **Haiku** (after 4; parallel with 5)

**Edit:** `PlayerPage.tsx` (`onKeyDown`, `KEYS`), panels.

Keyboard (add to the existing `onKeyDown`, same guard rules — it already ignores inputs, so typing `h` in the cloze box is safe):
- `h` / `H` → `takeHint()` when `canHint`.
- `n` / `N` → `next()` in `revealed`/`skipped`.
- Add both to `KEYS`: `["H", "Take the next hint"]`, `["N", "Next step (after the answer)"]`.
- Space/←/→ keep their replay meaning (§15.11). Enter submits the form natively; no extra code.

Focus (use a `useEffect` keyed on state + hints length; call `.focus()` on refs):
- New hint → focus that hint's `<li>`.
- Wrong answer, no hint taken yet → focus the Hint button.
- Enter `revealed`/`skipped` (once `reveal` loads) → focus the RevealPanel heading.
- Next → focus the new step's `<legend>`'s fieldset first control (first radio / text input).
- CONFLICT → focus the status element is not possible (`role=status` isn't focusable); instead focus the Hint button if `canHint`, else the panel heading.
- `finished` → focus the "Lesson complete" heading.
- Never steal focus from Monaco or an open dialog: skip if `document.activeElement` is inside `.monaco-editor` or a `dialog[open]`.

Reduced motion:
- Replay already goes `instant` (useReplay). Keep it.
- Any new transition/animation in the panels uses `motion-safe:` / `motion-reduce:transition-none` like `Dock.tsx`.
- Narration still plays under reduced motion (it's not motion).

Live region: the existing `role="status"` at the bottom of `PlayerPage` should announce state changes: `"Step 2 of 3: <title>"` on load, `"Correct"` / `"Not quite"` / `"Answer revealed"` / `"Skipped"` / `"Lesson complete"`.

**Done when:** the whole flow in Task 4's check can be done with keyboard only (Tab, Space/Enter, arrows in the radio group, `h`, `n`), focus lands where listed, and with macOS "Reduce motion" on the replay jumps straight to the end.

## Task 7 — Playwright + smoke + axe · **Haiku** (after 5, 6)

**Install (root):** `pnpm add -Dw @playwright/test @axe-core/playwright`, then `pnpm exec playwright install chromium`.
**New:** `playwright.config.ts` (root), `e2e/smoke/player.spec.ts`. **Edit:** root `package.json` script `"e2e": "playwright test"`; `.github/workflows/ci.yml` add after the turbo step:
```yaml
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm e2e
```

`playwright.config.ts`: `testDir: "e2e"`, chromium only, `use.baseURL: "http://localhost:4173"`, `webServer: { command: "pnpm --filter @learnquest/web build && pnpm --filter @learnquest/web preview --port 4173 --strictPort", url: "http://localhost:4173", reuseExistingServer: !process.env.CI }`. Running against the **production build** is deliberate: it proves the shipped bundle has no answers.

`beforeEach`: `await request.post("/api/__reset")`.

Helper `axe(page)`: `new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze()` → `expect(violations).toEqual([])`. If Monaco itself produces violations, `.exclude(".monaco-editor")` with a `// shortcut:` comment naming the rule — do not exclude anything else.

**Smoke test** "predict → miss → hint → reveal → next" (+ skip to reach the rest):
1. `goto("/play")`, wait for the s1 prompt. **axe** (predicting).
2. Check option 1 ("A for loop…"), Submit → see "Not quite."; Submit is disabled. **axe** (hinting).
3. Press `h` → hint 1 visible; "Math.max over the prices" radio is disabled; Submit enabled.
4. Check "reduce, with the sum starting at 0", Submit → heading "Here's the answer" focused; caption visible; "View source on GitHub" link has the right href. **axe** (revealed).
5. Click "Next step" → s2 prompt visible.
6. Click Skip → heading "Skipped — here's the answer". **axe** (skipped).
7. Press `n` → s3; Skip; click "Finish lesson" → "Lesson complete". **axe** (finished).

Also add `test.use({ reducedMotion: "reduce" })` in a second describe that repeats steps 1–4 only (proves the instant path works).

**Done when:** `pnpm e2e` passes locally twice in a row.

## Task 8 — Leak check + 409 test · **Sonnet** (after 7)

**New:** `e2e/smoke/leak.spec.ts`.

Leak test:
- Before `goto`, attach `page.on("response")`. For every response until the first request whose URL ends with `/api/steps/s1/reveal`: record the URL; if the content type is text/JS/JSON/HTML, read `await res.text()` and keep it.
- Import `secretsOf` from `../../apps/web/src/player/fixtures/lesson1.ts`.
- Do the same flow as smoke steps 1–4 (miss, hint, correct).
- Assert: no kept body contains any string in `secretsOf("s1")`; no kept body contains `"answer"` as a JSON key (`/"answer"\s*:/`); no recorded URL contains `/audio/`.
- After reveal: assert a request for `/audio/lesson-1/s1.mp3` happened (proves narration is requested only after reveal).
- Then click Next and repeat the body check for `secretsOf("s2")` only, up to the s2 reveal (skip it). Don't check s1's secrets here: s2's `beforeFiles` contains s1's result by design.

409 test (API level, `request` fixture):
- miss on s1 → POST another attempt → `409`; POST hint → 200; attempt → 200.
- skip s2 → attempt on s2 → `409`; reveal s3 before answering → `409`.
- UI: after the miss, `expect(page.getByRole("button", { name: "Submit" })).toBeDisabled()`.

**Done when:** `pnpm e2e` passes. Then temporarily re-add `import lesson from "./fixtures/lesson1"` + a `console.log(lesson)` in `PlayerPage.tsx`, run `pnpm e2e`, confirm the leak test **fails**, and remove it again. (Proves the test can catch a leak.)

---

## Order and model summary

| # | Task | Model | Depends on |
|---|---|---|---|
| 1a | Lesson 1 secret content | Haiku | — |
| 1b | Mock API plugin | Sonnet | 1a |
| 2 | State machine + unit tests | Sonnet | — (parallel with 1a/1b) |
| 3 | API client + `useStepFlow` | Sonnet | 1b, 2 |
| 4 | Panels + PlayerPage wiring | Sonnet | 3 |
| 5 | Narration + captions | Haiku | 4 (parallel with 6) |
| 6 | Keyboard, focus, reduced motion | Haiku | 4 (parallel with 5) |
| 7 | Playwright, smoke, axe, CI | Haiku | 5, 6 |
| 8 | Leak check + 409 test | Sonnet | 7 |

5 and 6 both edit `PlayerPage.tsx` and `RevealPanel.tsx`: run them one after the other, or in separate worktrees and merge.

## Out of scope (do not build)

Real API/auth (WP5), navigating back to earlier steps, BKT/mastery updates, MP3 rendering (WP11), the router swap, a transcript page, caption on/off toggle, live TTS.

## Known risks

- **Vercel `/play` breaks until WP5 ships**: the static deploy has no `/api`. Either accept it for a week or don't deploy this branch to prod before the API lands.
- Contract additions (D3: `attemptAllowed`, `rungsTaken`, `hints[]` on the step response) must be copied into WP5's routes and `packages/lesson-schema`.
- `speechSynthesis` in headless Chromium may have no voices; the e2e test checks the caption and the `/audio/` request, not that sound came out.
