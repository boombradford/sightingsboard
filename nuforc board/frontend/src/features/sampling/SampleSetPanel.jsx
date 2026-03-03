export default function SampleSetPanel({ sampleSets, activeSetId, onOpenSet }) {
  if (!Array.isArray(sampleSets) || !sampleSets.length) {
    return <p className="text-caption text-slate-500">No saved sample sets yet.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {sampleSets.map((set) => {
        const active = set.set_id === activeSetId;
        return (
          <li key={set.set_id}>
            <button
              type="button"
              onClick={() => onOpenSet(set.set_id)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? "border-accent/30 bg-accent-muted text-accent"
                  : "border-white/[0.06] bg-white/[0.02] text-slate-300 hover:border-white/[0.10] hover:text-slate-100"
              }`}
            >
              <p className="text-caption font-medium">{set.name}</p>
              <p className="mt-0.5 text-micro font-mono text-slate-500">{set.set_id} &middot; {set.item_count} cases</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
