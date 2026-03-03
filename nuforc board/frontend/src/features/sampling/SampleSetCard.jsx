import QualityBadge from "../quality/QualityBadge";
import Badge from "../shared/Badge";

export default function SampleSetCard({ item }) {
  return (
    <article className="rounded-lg border border-white/[0.04] bg-surface-deepest/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro font-mono text-slate-500">#{item.sighting_id}</span>
        <QualityBadge label={item.quality_label} score={item.quality_score} />
      </div>
      <p className="mt-1 text-caption text-slate-300">
        {item.date_time} &middot; {item.city}, {item.state} &middot; {item.shape}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="neutral">{item.duration || "n/a"}</Badge>
        <Badge variant="neutral">{item.observer_count ?? "?"} obs.</Badge>
        <Badge variant={item.explainable ? "warning" : "accent"}>
          {item.explainable ? "Explainable" : "Unexplained"}
        </Badge>
        <Badge variant={item.ai_brief_status === "available" ? "success" : "neutral"}>
          AI: {item.ai_brief_status === "available" ? "Ready" : "Pending"}
        </Badge>
      </div>
    </article>
  );
}
