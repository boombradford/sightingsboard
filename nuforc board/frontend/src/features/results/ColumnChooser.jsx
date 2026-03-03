const COLUMNS = [
  ["date_time", "Date"],
  ["location", "Location"],
  ["shape", "Shape"],
  ["duration", "Duration"],
  ["observers", "Observers"],
  ["quality", "Quality"],
  ["evidence", "Evidence"],
  ["signals", "Signals"],
];

export default function ColumnChooser({ columns, onToggle }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-200">
      <span className="uppercase tracking-[0.12em] text-slate-400">Columns</span>
      {COLUMNS.map(([key, label]) => {
        const active = columns.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            className={`rounded-full border px-2 py-0.5 ${
              active
                ? "border-cyan-300/70 bg-cyan-500/15 text-cyan-100"
                : "border-slate-500/35 bg-slate-900/70 text-slate-300"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
