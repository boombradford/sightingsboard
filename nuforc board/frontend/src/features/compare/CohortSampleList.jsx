import QualityBadge from "../quality/QualityBadge";

export default function CohortSampleList({ cases }) {
  if (!Array.isArray(cases) || !cases.length) {
    return <p className="text-xs text-zinc-400">No sampled cases for this cohort.</p>;
  }

  return (
    <ul className="grid gap-2">
      {cases.slice(0, 6).map((item) => (
        <li key={item.sighting_id} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-zinc-300">#{item.sighting_id}</p>
            <QualityBadge label={item.quality_label} score={item.quality_score} />
          </div>
          <p className="mt-1 text-zinc-200">
            {item.date_time} | {item.city}, {item.state} | {item.shape}
          </p>
        </li>
      ))}
    </ul>
  );
}
