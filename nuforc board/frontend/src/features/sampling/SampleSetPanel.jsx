export default function SampleSetPanel({ sampleSets, activeSetId, onOpenSet }) {
  if (!Array.isArray(sampleSets) || !sampleSets.length) {
    return <p className="text-xs text-slate-400">No saved sample sets yet.</p>;
  }

  return (
    <ul className="grid gap-2">
      {sampleSets.map((set) => {
        const active = set.set_id === activeSetId;
        return (
          <li key={set.set_id}>
            <button
              type="button"
              onClick={() => onOpenSet(set.set_id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${
                active
                  ? "border-cyan-300/70 bg-cyan-500/15 text-cyan-100"
                  : "border-slate-500/30 bg-slate-900/65 text-slate-200"
              }`}
            >
              <p className="font-semibold uppercase tracking-[0.12em]">{set.name}</p>
              <p className="mt-0.5 font-mono text-[10px] text-slate-400">{set.set_id} | {set.item_count} cases</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
