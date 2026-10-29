type Props = { label?: string };

const blocks = [
  { glyph: "{ }", bg: "bg-sun", delay: "0s" },
  { glyph: "=>", bg: "bg-pink", delay: "0.7s" },
  { glyph: "✓", bg: "bg-mint", delay: "1.4s" },
];

// Three code blocks press in turn, like keys being typed. Motion stops under prefers-reduced-motion (index.css).
export default function Loader({ label = "Loading" }: Props) {
  return (
    <div role="status" className="flex flex-col items-center gap-5">
      <div className="flex gap-3">
        {blocks.map((b) => (
          <span
            key={b.glyph}
            className={`loader-block ${b.bg}`}
            style={{ animationDelay: b.delay }}
          >
            {b.glyph}
          </span>
        ))}
      </div>
      <p className="flex items-center gap-2 rounded-full border-[3px] border-ink bg-white px-5 py-2 text-sm font-extrabold shadow-[0_4px_0_var(--color-ink)]">
        {label}
        <span aria-hidden="true" className="flex gap-1">
          <i className="loader-dot" style={{ animationDelay: "0s" }} />
          <i className="loader-dot" style={{ animationDelay: "0.15s" }} />
          <i className="loader-dot" style={{ animationDelay: "0.3s" }} />
        </span>
      </p>
    </div>
  );
}
