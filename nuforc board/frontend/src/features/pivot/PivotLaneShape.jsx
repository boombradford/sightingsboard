import { useMemo } from "react";
import { m } from "motion/react";
import MiniHistogram from "./MiniHistogram";
import PinToggle from "./PinToggle";

export default function PivotLaneShape({ options, bins, value, pinned, onChange, onTogglePin }) {
  const topShapes = useMemo(() => {
    const fromBins = Array.isArray(bins)
      ? bins.map((bin) => String(bin.shape || bin.key || "").trim()).filter(Boolean)
      : [];
    const fromOptions = Array.isArray(options) ? options : [];
    const merged = [...new Set([...fromBins, ...fromOptions])];
    return merged.slice(0, 8);
  }, [bins, options]);

  return (
    <section className="glass-card flex min-w-0 flex-col gap-2 p-3" aria-label="Shape pivot lane">
      <div className="flex items-center justify-between gap-2">
        <h3 className="panel-title">Shape</h3>
        <PinToggle pinned={pinned} onToggle={onTogglePin} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <m.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => onChange("")}
          className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] ${
            !value
              ? "border-cyan-300/80 bg-cyan-500/15 text-cyan-100"
              : "border-slate-500/35 bg-slate-900/80 text-slate-200"
          }`}
        >
          All
        </m.button>
        {topShapes.map((shape) => {
          const active = value && value.toLowerCase() === shape.toLowerCase();
          return (
            <m.button
              key={shape}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onChange(shape)}
              className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] ${
                active
                  ? "border-cyan-300/80 bg-cyan-500/15 text-cyan-100"
                  : "border-slate-500/35 bg-slate-900/80 text-slate-200"
              }`}
            >
              {shape}
            </m.button>
          );
        })}
      </div>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-slate-500/40 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-100"
      >
        <option value="">More shapes...</option>
        {(Array.isArray(options) ? options : []).map((shape) => (
          <option key={shape} value={shape}>
            {shape}
          </option>
        ))}
      </select>

      <MiniHistogram bins={bins} selectedKey={value} keyField="shape" />
    </section>
  );
}
