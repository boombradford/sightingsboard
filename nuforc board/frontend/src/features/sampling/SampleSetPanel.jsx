export default function SampleSetPanel({ sampleSets, activeSetId, onOpenSet }) {
  if (!Array.isArray(sampleSets) || !sampleSets.length) {
    return <p className="text-caption text-zinc-500">No saved sample sets yet.</p>;
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
              className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                active
                  ? "border-amber-500/25 bg-amber-500/[0.06] text-amber-400"
                  : "border-zinc-700 bg-zinc-800/40 text-zinc-200 hover:border-zinc-600 hover:text-zinc-100"
              }`}
            >
              <p className="text-caption font-medium">{set.name}</p>
              <p className="mt-0.5 font-mono text-micro text-zinc-500">{set.set_id} &middot; {set.item_count} cases</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
