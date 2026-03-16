import { m } from "motion/react";
import { cardHover } from "../../lib/motion";
import QualityBadge from "../quality/QualityBadge";
import Badge from "../shared/Badge";

export default function SampleSetCard({ item }) {
  return (
    <m.article
      className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 transition-colors hover:border-zinc-700"
      {...cardHover}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-micro text-zinc-400">#{item.sighting_id}</span>
        <QualityBadge label={item.quality_label} score={item.quality_score} />
      </div>
      <p className="mt-1 text-caption text-zinc-200">
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
    </m.article>
  );
}
