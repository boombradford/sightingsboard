const SCORE_COMPONENTS = [
  { key: "description_richness", label: "Richness", max: 25, color: "bg-amber-500" },
  { key: "signal_density", label: "Signals", max: 20, color: "bg-blue-500" },
  { key: "witness_strength", label: "Witnesses", max: 15, color: "bg-emerald-500" },
  { key: "corroboration", label: "Corroboration", max: 15, color: "bg-purple-500" },
  { key: "location_specificity", label: "Location", max: 10, color: "bg-cyan-500" },
  { key: "media_mention", label: "Media", max: 10, color: "bg-pink-500" },
  { key: "shape_rarity", label: "Rarity", max: 5, color: "bg-orange-500" },
];

export default function StoryScoreBreakdown({ storyScore, breakdown }) {
  if (storyScore == null && !breakdown) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-micro uppercase tracking-wider text-zinc-500">Story Score</span>
        <span className="rounded bg-amber-500/10 px-2 py-0.5 font-mono text-caption font-bold text-amber-400">
          {storyScore ?? 0}
        </span>
      </div>
      {breakdown && (
        <div className="space-y-1.5">
          {SCORE_COMPONENTS.map(({ key, label, max, color }) => {
            const value = breakdown[key] ?? 0;
            const pct = max > 0 ? (value / max) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-24 text-micro text-zinc-400 truncate">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-micro text-zinc-500">
                  {value}/{max}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
