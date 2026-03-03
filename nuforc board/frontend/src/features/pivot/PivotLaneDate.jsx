import { m } from "motion/react";
import MiniHistogram from "./MiniHistogram";
import PinToggle from "./PinToggle";

const PRESETS = [
  { label: "Last 12 months", years: 1 },
  { label: "Last 5 years", years: 5 },
  { label: "1990s", range: ["1990-01-01", "1999-12-31"] },
  { label: "2000s", range: ["2000-01-01", "2009-12-31"] },
  { label: "2010s", range: ["2010-01-01", "2019-12-31"] },
  { label: "All", range: ["", ""] },
];

function computePresetRange(preset) {
  if (preset.range) {
    return { from: preset.range[0], to: preset.range[1] };
  }
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setFullYear(now.getFullYear() - preset.years);
  return { from: start.toISOString().slice(0, 10), to: end };
}

export default function PivotLaneDate({
  fromDate,
  toDate,
  dateBins,
  pinned,
  onDateChange,
  onPreset,
  onTogglePin,
}) {
  return (
    <section className="glass-card flex min-w-0 flex-col gap-2 p-3" aria-label="Date pivot lane">
      <div className="flex items-center justify-between gap-2">
        <h3 className="panel-title">Date</h3>
        <PinToggle pinned={pinned} onToggle={onTogglePin} />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
          From
          <input
            type="date"
            value={fromDate}
            onChange={(event) => onDateChange("from_date", event.target.value)}
            className="rounded-lg border border-slate-500/40 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
          To
          <input
            type="date"
            value={toDate}
            onChange={(event) => onDateChange("to_date", event.target.value)}
            className="rounded-lg border border-slate-500/40 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-100"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <m.button
            key={preset.label}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              const range = computePresetRange(preset);
              onPreset(range);
            }}
            className="rounded-full border border-slate-500/35 bg-slate-900/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-200"
          >
            {preset.label}
          </m.button>
        ))}
      </div>

      <MiniHistogram bins={dateBins} selectedKey={fromDate?.slice(0, 7)} keyField="date" />
    </section>
  );
}
