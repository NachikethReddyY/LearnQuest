import * as Slider from "@radix-ui/react-slider";
import type { Timeline } from "@learnquest/player-core";
import { SPEEDS, stepIndexAt, type Speed } from "./useReplay";

type Props = {
  timeline: Timeline;
  titles: string[];
  t: number;
  playing: boolean;
  speed: Speed;
  playRef: React.RefObject<HTMLButtonElement | null>;
  onToggle(): void;
  onSeek(t: number): void;
  onSpeed(s: Speed): void;
};

const SEG = 1000; // slider units per step: equal-width segments
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export default function TransportBar({ timeline, titles, t, playing, speed, playRef, onToggle, onSeek, onSpeed }: Props) {
  const { steps } = timeline;
  const n = steps.length;

  const cur = stepIndexAt(timeline, t);
  const toSlider = (ms: number) => {
    const s = steps[cur];
    const f = s.endT > s.startT ? (ms - s.startT) / (s.endT - s.startT) : 0;
    return cur * SEG + Math.min(1, Math.max(0, f)) * SEG;
  };
  const toMs = (v: number) => {
    const i = Math.min(n - 1, Math.floor(v / SEG));
    const s = steps[i];
    return s.startT + Math.min(1, (v - i * SEG) / SEG) * (s.endT - s.startT);
  };

  const btn =
    "pill min-h-11 min-w-11 px-4 py-1 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-blue sm:min-h-8";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button ref={playRef} type="button" className={`${btn} ${playing ? "bg-mint" : "bg-sun"}`} aria-pressed={playing} onClick={onToggle}>
          {playing ? "Pause" : "Play"}
        </button>
        <label className="flex items-center gap-2 text-sm font-extrabold">
          Speed
          <select
            value={String(speed)}
            onChange={(e) => onSpeed(SPEEDS.find((s) => String(s) === e.target.value) ?? 1)}
            className="min-h-11 rounded-lg border-[3px] border-ink bg-white px-2 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-blue sm:min-h-8"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={String(s)}>
                {s === "instant" ? "Instant" : `${s}×`}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto font-mono text-sm font-bold" aria-hidden="true">
          {mmss(t)} / {mmss(timeline.duration)}
        </span>
      </div>

      <Slider.Root
        className="relative flex h-6 w-full touch-none items-center select-none"
        min={0}
        max={n * SEG}
        step={1}
        value={[toSlider(t)]}
        onValueChange={([v]) => onSeek(toMs(v))}
      >
        <Slider.Track className="track relative h-4 grow">
          {steps.slice(1).map((_, i) => (
            <span key={i} className="absolute top-0 h-full w-0.5 bg-ink" style={{ left: `${((i + 1) / n) * 100}%` }} />
          ))}
          <Slider.Range className="absolute h-full bg-green" />
        </Slider.Track>
        <Slider.Thumb
          aria-label="Timeline"
          aria-valuetext={`Step ${cur + 1} of ${n}, ${mmss(t)}`}
          className="block size-6 rounded-full border-[3px] border-ink bg-sun focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-blue"
        />
      </Slider.Root>

      <ol className="flex">
        {steps.map((s, i) => (
          <li key={i} className="flex-1">
            <button
              type="button"
              aria-label={`Go to step ${i + 1}: ${titles[i]}`}
              aria-current={i === cur ? "step" : undefined}
              onClick={() => onSeek(s.startT)}
              className={`min-h-11 w-full rounded-md px-1 text-xs font-bold focus-visible:outline-4 focus-visible:outline-offset-[-2px] focus-visible:outline-blue sm:min-h-6 ${i === cur ? "underline decoration-2" : ""}`}
            >
              {i + 1}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
