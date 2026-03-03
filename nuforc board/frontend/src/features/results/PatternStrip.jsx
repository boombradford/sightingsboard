function prettySignal(signal) {
  return String(signal || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function PatternStrip({ signals, activeSignal, onToggleSignal }) {
  const items = Array.isArray(signals) ? signals.slice(0, 5) : [];
  if (!items.length) {
    return <p className="text-xs text-slate-400">No pattern signals available for this slice.</p>;
  }

  return (
    <section className="glass-card grid gap-2 p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Pattern strip</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((signal) => {
          const active = activeSignal === signal.key;
          return (
            <button
              key={signal.key}
              type="button"
              onClick={() => onToggleSignal(signal.key)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                active
                  ? "border-cyan-300/70 bg-cyan-500/15 text-cyan-100"
                  : "border-slate-500/35 bg-slate-900/75 text-slate-200"
              }`}
            >
              {prettySignal(signal.key)} {signal.pct}%
            </button>
          );
        })}
      </div>
    </section>
  );
}
