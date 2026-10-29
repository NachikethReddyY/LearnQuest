import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useApi, type ExplorePath } from "../lib/api";
import { trpc } from "../lib/trpc";
import TopNav from "../components/TopNav";
import { AiBadge, Page, PipEmpty, Spinner } from "../components/Bits";

const tabs = [["official", "Official"], ["community", "Community"], ["mine", "Mine"]] as const;

function Publish({ p, onDone }: { p: ExplorePath; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "confirm" | "busy" | "error">("idle");
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state === "confirm") confirmRef.current?.focus();
  }, [state]);
  if (state === "idle" || state === "error")
    return (
      <div>
        <button type="button" className="btn !px-5 !py-2 text-sm" onClick={() => setState("confirm")}>Publish</button>
        {state === "error" && <p role="alert" className="mt-1 text-sm font-bold">Couldn't publish. Try again.</p>}
      </div>
    );
  return (
    <div role="group" aria-label={`Publish ${p.title}`} className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-extrabold">Make this path public?</span>
      <button ref={confirmRef} type="button" disabled={state === "busy"} className="btn !px-4 !py-1.5 text-sm disabled:opacity-60"
        onClick={() => { setState("busy"); trpc.paths.publish.mutate({ slug: p.slug }).then(onDone, () => setState("error")); }}>
        Yes, publish
      </button>
      <button type="button" disabled={state === "busy"} className="pill bg-white px-4 py-1.5 text-sm" onClick={() => setState("idle")}>Cancel</button>
    </div>
  );
}

function Row({ p, onDone, scope }: { p: ExplorePath; onDone: () => void; scope: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <li className="chunk bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-2xl font-black">{p.title}{p.origin === "ai" && <AiBadge />}</h2>
          <p className="text-sm font-semibold text-ink/70">{p.tagline}</p>
          <p className="mt-1 text-xs font-extrabold">{p.courseCount} {p.courseCount === 1 ? "course" : "courses"} · {p.learners} {p.learners === 1 ? "learner" : "learners"}</p>
        </div>
        {scope === "mine" && p.visibility === "private" ? (
          <Publish p={p} onDone={onDone} />
        ) : p.enrolled ? (
          <span className="pill bg-mint px-4 py-1.5 text-sm">Joined ✓</span>
        ) : (
          <button type="button" disabled={busy} className="btn !px-5 !py-2 text-sm disabled:opacity-60"
            onClick={() => { setBusy(true); trpc.paths.enroll.mutate({ slug: p.slug }).then(onDone).catch(() => {}).finally(() => setBusy(false)); }}>
            Join
          </button>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {p.courses.map((c) => (
          <li key={c.slug}><Link to="/courses/$slug" params={{ slug: c.slug }} className="pill bg-paper px-3 py-1 text-sm">{c.title}</Link></li>
        ))}
      </ul>
    </li>
  );
}

export default function Explore() {
  const [scope, setScope] = useState<(typeof tabs)[number][0]>("official");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, loading, reload } = useApi(`paths:${scope}:${dq}`, () => trpc.paths.list.query({ scope, q: dq || undefined }));

  return (
    <>
      <TopNav />
      <Page>
        <h1 className="font-display text-5xl font-black">Explore</h1>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Path source" className="flex gap-2">
            {tabs.map(([v, label]) => (
              <button key={v} type="button" aria-pressed={scope === v} onClick={() => setScope(v)}
                className={`pill px-4 py-1.5 text-sm ${scope === v ? "bg-sun" : "bg-white"}`}>{label}</button>
            ))}
          </div>
          <div className="min-w-48 flex-1 sm:max-w-xs">
            <label htmlFor="q" className="sr-only">Search paths</label>
            <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search paths"
              className="w-full rounded-xl border-[3px] border-ink bg-white px-4 py-2 font-semibold outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue" />
          </div>
        </div>
        <div className="mt-6">
          {error ? <PipEmpty img="pip-oops">Couldn't load paths.</PipEmpty>
            : loading || !data ? <Spinner />
            : data.length === 0 ? <PipEmpty>{scope === "mine" ? "You haven't joined or made any paths yet." : "Nothing here yet."}</PipEmpty>
            : <ul className="space-y-5">{data.map((p) => <Row key={p.slug} p={p} onDone={reload} scope={scope} />)}</ul>}
        </div>
      </Page>
    </>
  );
}
