import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

export type WinId = "instructions" | "code";
export type WinState = "open" | "minimized" | "closed";
export type Rect = { x: number; y: number; w: number; h: number };
export type Win = Rect & { state: WinState; z: number };

const MIN_W = 320;
const MIN_H = 240;
const GAP = 16;
const DOCK = 88; // bottom space kept free for the dock
type Size = { w: number; h: number };
type Desk = Size & { ox: number; oy: number; vw: number; vh: number }; // desktop size, its viewport origin, viewport size
export type Fill = { id: WinId; kind: "zoom" | "full" } | null;

const bounds = (s: Size): Size => ({ w: s.w, h: Math.max(0, s.h - DOCK) });

/** Keeps a rect inside the bounds; when resizing, the size gives way and the position stays. */
function clampRect(r: Rect, b: Size, resize = false): Rect {
  const w = Math.min(Math.max(resize ? Math.min(r.w, b.w - r.x) : r.w, MIN_W), Math.max(MIN_W, b.w));
  const h = Math.min(Math.max(resize ? Math.min(r.h, b.h - r.y) : r.h, MIN_H), Math.max(MIN_H, b.h));
  return { x: Math.max(0, Math.min(r.x, b.w - w)), y: Math.max(0, Math.min(r.y, b.h - h)), w, h };
}

function layout(s: Size, task: boolean): Record<WinId, Rect> {
  const b = bounds(s);
  const h = b.h - 2 * GAP;
  if (!task) return { instructions: { x: GAP, y: GAP, w: 0, h: 0 }, code: { x: GAP, y: GAP, w: b.w - 2 * GAP, h } };
  const iw = Math.round((b.w - 3 * GAP) * 0.34);
  return {
    instructions: { x: GAP, y: GAP, w: iw, h },
    code: { x: 2 * GAP + iw, y: GAP, w: b.w - 3 * GAP - iw, h },
  };
}

/** Window manager state: plain React state, positions in px inside the desktop element. */
export function useWindows(desktop: RefObject<HTMLElement | null>, task: boolean, enabled: boolean) {
  const [size, setSize] = useState<Desk>({ w: 0, h: 0, ox: 0, oy: 0, vw: 0, vh: 0 });
  const [wins, setWins] = useState<Partial<Record<WinId, Win>>>({}); // only windows the user touched; the rest follow the default layout
  // Zoom/full screen are display-only: the stored rect is untouched, so leaving restores it exactly.
  const [fill, setFill] = useState<Fill>(null);
  const [dragging, setDragging] = useState(false);
  const zTop = useRef(10);

  useEffect(() => {
    const el = desktop.current;
    if (!enabled || !el) return;
    const ro = new ResizeObserver(([e]) => {
      const s = { w: e.contentRect.width, h: e.contentRect.height };
      const o = el.getBoundingClientRect();
      setSize({ ...s, ox: o.left, oy: o.top, vw: document.documentElement.clientWidth, vh: window.innerHeight });
      setWins((o) =>
        Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v, ...clampRect(v, bounds(s)) }])),
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [desktop, enabled]);

  const base = (id: WinId): Win => ({ ...layout(size, task)[id], state: "open", z: id === "code" ? 2 : 1 });
  const get = (id: WinId): Win => wins[id] ?? base(id);
  const patch = (id: WinId, fn: (w: Win) => Partial<Win>) => setWins((o) => ({ ...o, [id]: { ...(o[id] ?? base(id)), ...fn(o[id] ?? base(id)) } }));

  const front = (id: WinId) => patch(id, () => ({ z: ++zTop.current }));
  const change = (id: WinId, kind: "move" | "resize", dx: number, dy: number, b: Size, from?: Rect) =>
    patch(id, (cur) => {
      const s = from ?? cur;
      return clampRect(kind === "move" ? { ...s, x: s.x + dx, y: s.y + dy } : { ...s, w: s.w + dx, h: s.h + dy }, b, kind === "resize");
    });

  /** Rect to draw: a zoomed window fills the desktop, a full-screen one the whole viewport. */
  const rect = (id: WinId): Win | undefined => {
    if (!size.w) return undefined;
    const w = get(id);
    if (fill?.id !== id) return w;
    if (fill.kind === "full") return { ...w, x: -size.ox, y: -size.oy, w: size.vw, h: size.vh, z: 3000 };
    const b = bounds(size);
    return { ...w, x: GAP, y: GAP, w: b.w - 2 * GAP, h: b.h - 2 * GAP, z: 1000 };
  };
  const ids: WinId[] = task ? ["instructions", "code"] : ["code"];
  const frontId = ids.filter((i) => get(i).state === "open").sort((a, b) => get(b).z - get(a).z)[0] as WinId | undefined;
  const toggleFill = (id: WinId, kind: "zoom" | "full") => {
    setFill((f) => (f?.id === id && f.kind === kind ? null : f?.kind === "full" && kind === "zoom" ? f : { id, kind }));
    front(id);
  };

  return {
    fill,
    dragging,
    frontId,
    state: (id: WinId) => get(id).state,
    rect,
    front,
    open: (id: WinId) => patch(id, () => ({ state: "open", z: ++zTop.current })),
    setState: (id: WinId, state: WinState) => {
      if (fill?.kind === "full" && fill.id === id) {
        if (state === "minimized") return; // minimize is disabled while full screen
        setFill(null);
      }
      patch(id, () => ({ state }));
    },
    toggleZoom: (id: WinId) => toggleFill(id, "zoom"),
    toggleFull: (id: WinId) => toggleFill(id, "full"),
    /** Pointer drag (move or resize). Window-level listeners, so it tracks outside the element. */
    drag: (id: WinId, kind: "move" | "resize", e: ReactPointerEvent) => {
      if (fill?.id === id || e.button !== 0) return;
      e.preventDefault();
      const start = get(id);
      const b = bounds(size);
      const x0 = e.clientX;
      const y0 = e.clientY;
      const move = (ev: PointerEvent) => change(id, kind, ev.clientX - x0, ev.clientY - y0, b, start);
      const up = () => {
        setDragging(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      setDragging(true);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    nudge: (id: WinId, kind: "move" | "resize", dx: number, dy: number) => {
      if (fill?.id !== id) change(id, kind, dx, dy, bounds(size));
    },
  };
}
