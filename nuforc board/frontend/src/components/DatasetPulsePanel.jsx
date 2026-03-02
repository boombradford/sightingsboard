import { formatNumber, safeText } from "../lib/format";
import RankList from "./RankList";

export default function DatasetPulsePanel({ loadingStats, stats, geocodedPct }) {
  return (
    <section className="glass-card p-4">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-100">Dataset Pulse</h2>
        <p className="text-sm text-slate-400">2x2 quickboard for archive health.</p>
      </div>

      {loadingStats ? (
        <p className="text-sm text-slate-400">Loading stats...</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <article className="rounded-xl border border-slate-500/35 bg-slate-900/75 p-3">
            <h3 className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Total Sightings</h3>
            <p className="mt-1 font-mono text-lg text-slate-100">
              {formatNumber(stats?.total_sightings || 0)}
            </p>
            <p className="text-[11px] text-slate-400">
              {safeText(stats?.date_range?.min)} to {safeText(stats?.date_range?.max)}
            </p>
          </article>
          <article className="rounded-xl border border-slate-500/35 bg-slate-900/75 p-3">
            <h3 className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Geocoded Coverage</h3>
            <p className="mt-1 font-mono text-lg text-slate-100">
              {formatNumber(stats?.geocoded_sightings || 0)} ({geocodedPct}%)
            </p>
            <p className="text-[11px] text-slate-400">Rows with coordinates</p>
          </article>
          <article className="rounded-xl border border-slate-500/35 bg-slate-900/75 p-3">
            <h3 className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">Top Shapes</h3>
            <RankList rows={stats?.top_shapes} labelKey="shape" />
          </article>
          <article className="rounded-xl border border-slate-500/35 bg-slate-900/75 p-3">
            <h3 className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">Top States</h3>
            <RankList rows={stats?.top_states} labelKey="state" />
          </article>
        </div>
      )}
    </section>
  );
}
