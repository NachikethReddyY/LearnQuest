Primer — An AI learning world that grows with the student
YC-backed direction
Education / Consumer AI







wisdomforkids.app


The problem

Traditional educational applications often provide the same questions to everyone.

But two students might understand a concept completely differently.

One needs a visual explanation. Another needs an example. Another needs to practise applying the concept.

The product

A personalised learning environment that adapts its teaching style according to how someone learns.

For example, imagine a child learning fractions.

Instead of showing ten identical questions, the application might:
1. Introduce fractions through a visual story.
2. Give the student an interactive challenge.
3. Identify what they misunderstand.
4. Explain the concept using a different approach.
5. Adjust future challenges based on demonstrated understanding.
It gradually builds a model of what the learner understands.

This closely aligns with YC's Fall 2026 The Primer request: an adaptive AI tutor for young children's reading, writing and arithmetic. 
Y Combinator


The interesting engineering: Adaptive learning algorithms, student knowledge modelling, interactive graphics, content generation and progress tracking.

Why people might love it: It could make learning feel like exploration rather than completing worksheets.

For an assignment, narrow this to one age group and one subject instead of attempting to build an entire education platform.

The Pitch: Scrimba lets you pause a video and edit the code inside the player, but it is a closed, manual course platform. Scrim-Forge takes any GitHub PR, commit history, or local directory and automatically compiles an interactive, playable "code cast." Instead of recording heavy MP4 pixels, it records DOM/editor mutations, AST state transitions, and synchronized TTS voiceovers. At any second in the timeline, you can pause, edit the code right inside the "video" player, fork the execution timeline into a live browser sandbox, and ask an AI tutor why the author structured a function that way.   Real-World Grounding: Directly solves Y Combinator’s Fall 2026 Request for Startups ("The Primer" by Andrew Miklas—dynamic, interactive AI tutoring that replaces passive video watching) and fixes the exact pain of wanting a video-like, mutable way to read and understand real-world codebases.Recommended Stack: React, TypeScript, Monaco Editor API, WebContainers (or WASM/Pyodide for execution), Node.js/Fastify, PostgreSQL.3+ Core Architectural Patterns (For Your Report):Event Sourcing & Command Pattern: Recording timestamped keystroke, cursor, and file-tree mutations (InsertTextCommand, SwitchFileCommand) so scrubbing the timeline deterministically reconstructs editor state in $O(1)$ time via snapshots + delta replay.Hierarchical State Machine (XState/Zustand): Managing the transition between PLAYING_TIMELINE (read-only stream), PAUSED_INSPECT (AST hover analysis), and FORKED_SANDBOX (divergent user edits with hot-reload).In-Browser Sandboxed Virtual File System (VFS): Binding the virtual timeline state directly to an isolated execution worker without server round-trips.

Full readable version with visuals: https://files.instinct.com/utj5vkqrg4b8-scrim-forge-build-it-but-narrower (private, owner-only)

# Verdict

Conditional go as a focused project. No-go as a universal platform or a YC Primer play.

- Course project: strong. Startup: weak so far, Scrimba already has the player and a Node sandbox.

# What YC actually asks for

- Fall 2026 "The Primer" (Andrew Miklas) asks for a product that "adaptively teaches young children to read, write, and do arithmetic", bought by a parent. Nothing about coding. Source: https://www.ycombinator.com/rfs?batch=Fall+2026
- The pitch line "directly solves the YC request" is an overreach. The shared idea is adaptive tutoring only.

# Merged concept

1. Take one commit or PR.
2. Split it into ordered steps.
3. Replay each step as typing in an editor, pause and edit anytime.
4. Ask the learner to predict the change before it is revealed.
5. Hint ladder: hint, smaller example, answer. Log missed concepts.
6. Optional fork into a live sandbox.

# Claim check

- Any repo to cast automatically: git stores snapshots, not keystrokes, so replay is reconstructed. https://github.blog/open-source/git/commits-are-snapshots-not-diffs/
- O(1) scrubbing: snapshots plus deltas is bounded by snapshot spacing, not O(1) (my reading).
- XState and Zustand are different tools (state machine vs store).
- Sandbox: supported today, not absolute limits. WebContainers run Node.js in the browser, full on Chromium, beta elsewhere, commercial licence for production. https://webcontainers.io/enterprise https://webcontainers.io/guides/browser-support
- Pyodide runs Python in the browser but has no threads or multiprocessing, and ssl is a stub. Other languages may run via other WebAssembly runtimes or server containers (not researched). https://pyodide.org/en/stable/usage/wasm-constraints.html
- AI "why the author wrote it" is inference. Git keeps commit text, not reasoning.

# Competition

- Scrimba (YC S20): editable video, Node via WebContainers since April 2025. https://news.ycombinator.com/item?id=43771365
- DeepWiki, Google Code Wiki, Pocket Flow, CodeTour: docs or tours, not playable replays.
- Gap found in my search, not proof nobody has built it.

# Learning evidence

- Kestin et al. 2025: designed AI tutor beat active learning in Harvard physics. https://pmc.ncbi.nlm.nih.gov/articles/PMC12179260/
- Bastani et al. 2025: plain chatbot gave -17% on exams, guarded tutor removed the harm. https://pmc.ncbi.nlm.nih.gov/articles/PMC12232635/
- Anthropic 2026: AI group 50% vs 67% quiz among 52 engineers. https://www.anthropic.com/research/AI-assistance-coding-skills
- Rule: make the learner attempt before the answer.

# MVP

- JavaScript and TypeScript repos only (Python out of scope), one commit or PR, Monaco player, snapshots each step, prediction question plus hint ladder.
- WebContainers fork later. Cut TTS, AST hover, Postgres, Python, any-repo claims.
- Patterns for a report: event sourcing and command pattern, snapshot plus delta replay, state machine, VFS boundary.

# Limits

- AST analysis: per-language parser work. Voiceover (TTS): per-minute cost and voice quality questions. Neither quantified, both cut from the MVP.
- Model cost: LLM calls per step add up. Not priced. Measure tokens per lesson in the prototype.
- Licensing: WebContainers need a commercial licence for production, for-profit use (prototypes exempt). Repo licences govern showing and redistributing code. Not researched in depth.
- Running other people's code: use a curated repo list, not arbitrary URLs. Privacy: public repos only for now.

# Next step

1. Weekend: replay one Agni commit in Monaco, no AI.
2. Add one prediction question per step.
3. Test with three classmates: replay vs reading the diff, then a short quiz.
4. Go on only if the replay group does better.


Scrim-Forge: build it, but narrower
Conditional go as a focused project. No-go as a universal platform.

Merged with the Primer idea, it becomes an adaptive tutor for learning real code through playable walkthroughs. The core is viable. The pitch overclaims in several places, and the YC Primer request is about young children, not coding.

Illustration of a code editor with a timeline scrubber forking into a second editor
Illustration generated for this page. It is not a product screenshot.

Verdict
Build a TypeScript-only version that turns one commit or PR into a replayable, editable lesson with questions. Do not promise "any repo", and do not frame it as a YC Primer play.

As a course project
Strong. Good scope, real architecture patterns to write about.
As a startup
Weak so far. Scrimba already does most of the player.
YC fit
Low. The request is for ages 4 to 10.
Biggest risk
Learners watch instead of learning.
What YC actually asks for
The Fall 2026 Primer request asks for "a product that adaptively teaches young children to read, write, and do arithmetic, at the quality of a devoted private tutor and at consumer scale", something "a parent buys to help their child learn basic skills" (YC, 2026). Nothing in it mentions code, code review or developer education.

So the pitch line "directly solves Y Combinator's Fall 2026 Request for Startups" is an overreach. The shared idea is adaptive tutoring, nothing more. The screenshot you sent is a third-party write-up of the Primer. It shows a children's bakery app and itself advises narrowing to one age group and one subject. I could not identify who wrote it, so I treat it as a claim, not a source. I did not find a separate YC request for interactive code video.

Evidence versus interpretation
YC's wording is quoted from its page. "Low YC fit" is my judgement from that wording.
The merged concept
Keep Scrim-Forge's player. Borrow the Primer's one transferable idea: the tutor tracks what the learner misunderstands and changes the next step. For code, that means:

1
Take one commit or PR from a repo you want to understand.
2
Split it into ordered steps, one per hunk or logical change.
3
Replay each step as typing in an editor. The learner can pause and edit at any point.
4
Before each step is revealed, ask the learner to predict the change.
5
If they miss, give a hint, then a smaller example, then the answer. Log which concepts they miss.
6
Optionally fork into a live sandbox to try the change.
Claim check on the pitch
Any repo, PR or folder becomes a cast automatically
Partly true, and the framing is wrong. Git stores snapshots of files, not diffs or keystrokes (Stolee, 2020). So you can only reconstruct a plausible replay from the final diff. It must be labelled reconstructed, not recorded.
Overclaim
Records DOM and editor mutations
Feasible. Scrimba says it records events instead of pixels (Scrimba staff, 2019), and rrweb is an open-source DOM recorder (rrweb, n.d.). But recording needs a live author. Importing from git has no such events.
Half true
AST state transitions and TTS voiceover
Both look technically feasible with standard parsers and speech APIs. I did not research cost or quality. Cut both from the MVP.
Unverified
Scrub in O(1) with snapshots plus deltas
Snapshots plus deltas is a sound design. But replay cost depends on the distance to the nearest snapshot, so it is bounded, not O(1). This is my reading of the technique, not a sourced claim.
Overclaim
XState/Zustand as one state machine
They do different jobs. XState models the PLAYING, PAUSED and FORKED modes. Zustand is a store. Use them together or pick XState alone. Engineering judgement, not sourced.
Muddled
Fork into a sandbox that runs the code
Supported today, not absolute limits. WebContainers run Node.js in the browser, fully on Chromium and in beta on Firefox and Safari (StackBlitz, n.d.b). Pyodide runs Python but has no threading or multiprocessing, and its ssl module is a stub (Pyodide, n.d.). Other languages may run through other WebAssembly runtimes or server-side containers, but I did not research those. For the MVP, target JavaScript and TypeScript repos only. Python is out of scope.
Narrow
AI explains why the author wrote it that way
Git keeps the commit message and PR text, not the author's reasoning. The AI will infer. Show those explanations as inferred and cite the PR discussion when it exists.
Needs labels
Who already does this
Scrimba is the closest. It is a YC S20 company that launched as "an interactive video format for teaching and learning how to code" where students "can pause the video and edit the code" (Borgen, 2020). In April 2025 its CTO said they had integrated StackBlitz WebContainers, giving a full Node.js environment, terminal and file system inside the player. He also offered to record interactive videos for open-source maintainers and said its videos are embedded by MDN, LangChain and Coursera (Scrimba CTO, 2025).

Scrimba
Hand-recorded, editable, runnable lessons. Manual authoring. Closed platform.
DeepWiki and Code Wiki
AI documentation and chat for any repo (Cognition, 2025; Google, 2025). Text and diagrams, not playable replays.
Pocket Flow tutorial generator
Open-source (MIT) tool that turns a GitHub repo into a written beginner tutorial (Pocket Flow, n.d.).
CodeTour
MIT-licensed VS Code extension for recorded guided tours of a codebase (Microsoft, n.d.). Static steps, no replay.
The gap, and its limit
In what I found, none of these generates an editable, forkable replay from commit history with learner questions. That is a gap in my search, not proof nobody has built it. Scrimba could add it, since it already has the player and the sandbox.
Does it help people learn?
Three studies matter, and none tests this product.

Harvard physics, college students
Kestin et al. (2025): a carefully designed AI tutor beat in-class active learning. Median post-test 4.5 (N = 142) against 3.5 (N = 174). Median time on task was 49 minutes.
Turkish high school maths, nearly 1,000 students
Bastani et al. (2025): a plain chatbot lifted practice scores 48% but lowered exam scores 17%. A guarded tutor gained 127% on practice, and the exam harm was essentially removed.
52 software engineers learning a Python library
Anthropic (2026): the AI group scored 50% on the quiz against 67% for hand-coders. Those who asked for explanations kept more.
Design rule from the evidence: make the learner attempt before the answer is shown.

A realistic MVP
Language
TypeScript and JavaScript only. It matches your skills and WebContainers.
Input
One commit or PR from a permissively licensed repo, then your own Agni.
Player
Monaco editor, steps replayed from hunks, snapshots every step.
Sandbox
WebContainers fork, as a later step once replay works.
Tutor
One prediction question and a three-level hint ladder per step.
Cut for now
TTS, AST hover, Postgres accounts, Python, any-repo claims.
Patterns worth writing up if this is for a report: event sourcing with the command pattern for the timeline, snapshot plus delta replay, a state machine for player modes, and a virtual file system boundary around execution. These are standard patterns I am applying by judgement. I did not source each one.

Limits you will hit
Running other people's code
WebContainers run in the browser, but repos can still run install scripts and make network calls. Use a curated list, not arbitrary URLs.
Licensing
WebContainers need a commercial licence for production, for-profit use. Prototypes and proofs of concept do not (StackBlitz, n.d.a). Repo licences also govern showing and redistributing code. I did not research that in depth.
Browser support
Needs SharedArrayBuffer and cross-origin isolation. Chromium is fully supported, others are beta (StackBlitz, n.d.b).
AST analysis and voiceover
Both look feasible with standard parsers and speech APIs, but each adds per-language work (AST) or per-minute cost and voice quality questions (TTS). I did not quantify either, so they stay out of the MVP.
Privacy
Private repos would send code to an AI provider. Stay with public repos until you have a clear policy.
Cost
Model calls per step add up. I have not priced it. Measure tokens per lesson in the prototype.
Next step
1
This weekend: replay one real Agni commit in Monaco. No AI, no sandbox.
2
Add one prediction question per step.
3
Test with three classmates: replay lesson versus reading the same diff, then a short quiz, as in Anthropic (2026).
4
Go on only if the replay group scores better or finds it clearly easier. Otherwise the player is a toy.
If this is a school project, the MVP above is the project. If it is a startup, the question to answer first is why a learner would pick this over Scrimba.

References
All accessed 27 October 2026.

Y Combinator (2026) Requests for Startups: Fall 2026, "The Primer" by Andrew Miklas. https://www.ycombinator.com/rfs?batch=Fall+2026

Borgen, P. (2020) Launch HN: Scrimba (YC S20), Hacker News. https://news.ycombinator.com/item?id=24579699

Scrimba CTO (2025) Show HN: Node.js video tutorials where you can edit and run the code, Hacker News. https://news.ycombinator.com/item?id=43771365

Stack Overflow (2019) Scrimba.com interactive DOM recording algorithm (answer from Scrimba). https://stackoverflow.com/questions/55345973/scrimba-com-interactive-dom-recording-algorithm

Scrimba Guide (2026) How Scrimba scrims work (third-party review, September 2026). https://scrimbaguide.tech/docs/how-it-works/how-scrims-work/

Stolee, D. (2020) Commits are snapshots, not diffs, The GitHub Blog. https://github.blog/open-source/git/commits-are-snapshots-not-diffs/

StackBlitz (n.d.) WebContainers: commercial usage. https://webcontainers.io/enterprise

StackBlitz (n.d.) WebContainers browser support (updated October 2026). https://webcontainers.io/guides/browser-support

Pyodide (n.d.) Pyodide Python compatibility. https://pyodide.org/en/stable/usage/wasm-constraints.html

rrweb (n.d.) Record and replay the web. https://rrweb.com/

Microsoft (n.d.) CodeTour: VS Code extension to record and play back guided tours of codebases. https://github.com/microsoft/codetour/

Cognition (2025) DeepWiki: AI docs for any repo. https://cognition.com/blog/deepwiki

Google Developers Blog (2025) Introducing Code Wiki. https://developers.googleblog.com/en/introducing-code-wiki-accelerating-your-code-understanding/

The-Pocket (n.d.) PocketFlow Tutorial Codebase Knowledge (MIT licence). https://github.com/The-Pocket/PocketFlow-Tutorial-Codebase-Knowledge

Kestin, G. et al. (2025) AI tutoring outperforms in-class active learning, Scientific Reports. https://pmc.ncbi.nlm.nih.gov/articles/PMC12179260/

Bastani, H. et al. (2025) Generative AI without guardrails can harm learning, PNAS. https://pmc.ncbi.nlm.nih.gov/articles/PMC12232635/

Anthropic (2026) How AI assistance impacts the formation of coding skills. https://www.anthropic.com/research/AI-assistance-coding-skills

Sources read 27 October 2026. Pricing and product features can change.
