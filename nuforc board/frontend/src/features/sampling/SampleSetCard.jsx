import QualityBadge from "../quality/QualityBadge";

export default function SampleSetCard({ item }) {
  return (
    <article className="rounded-xl border border-slate-500/35 bg-slate-950/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-mono text-slate-300">#{item.sighting_id}</p>
        <QualityBadge label={item.quality_label} score={item.quality_score} />
      </div>
      <p className="mt-1 text-xs text-slate-200">
        {item.date_time} | {item.city}, {item.state} | {item.shape}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-300">
        <span className="rounded-full border border-slate-500/30 px-2 py-0.5">Duration: {item.duration || "n/a"}</span>
        <span className="rounded-full border border-slate-500/30 px-2 py-0.5">
          Observers: {item.observer_count ?? "n/a"}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 ${
            item.explainable
              ? "border-amber-300/40 bg-amber-500/10 text-amber-100"
              : "border-cyan-300/40 bg-cyan-500/10 text-cyan-100"
          }`}
        >
          {item.explainable ? "Explainable" : "Unexplained"}
        </span>
        <span className="rounded-full border border-slate-500/30 px-2 py-0.5">
          AI: {item.ai_brief_status === "available" ? "Ready" : "Pending"}
        </span>
      </div>
    </article>
  );
}
