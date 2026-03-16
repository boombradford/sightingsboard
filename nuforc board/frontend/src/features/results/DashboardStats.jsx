import { m } from "motion/react";
import { springs, stagger } from "../../lib/motion";
import CountUpNumber from "../shared/CountUpNumber";
import ShapeIcon from "../shared/ShapeIcon";

function StatCard({ label, children, index = 0, accent = false }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.smooth, delay: stagger(index) }}
      className={`rounded-lg border p-3 sm:p-4 ${
        accent
          ? "border-amber-500/15 bg-gradient-to-br from-amber-500/[0.04] to-transparent"
          : "border-zinc-800 bg-zinc-900"
      }`}
    >
      <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">{label}</p>
      {children}
    </m.div>
  );
}

function TopShapeBar({ shape, count, maxCount, index }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <m.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...springs.smooth, delay: stagger(index, { delay: 0.04 }) }}
      className="flex items-center gap-2"
    >
      <ShapeIcon shape={shape} size={14} className="text-zinc-400" />
      <span className="w-16 truncate text-caption text-zinc-200 capitalize">{shape}</span>
      <div className="relative flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <m.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ ...springs.smooth, delay: stagger(index, { delay: 0.04 }) + 0.1 }}
        />
      </div>
      <span className="w-12 text-right font-mono text-micro text-zinc-400">{count.toLocaleString()}</span>
    </m.div>
  );
}

function TopStateBar({ state: stateName, count, maxCount, index }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <m.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...springs.smooth, delay: stagger(index, { delay: 0.04 }) }}
      className="flex items-center gap-2"
    >
      <span className="w-8 font-mono text-caption font-medium text-zinc-300">{stateName}</span>
      <div className="relative flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <m.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ ...springs.smooth, delay: stagger(index, { delay: 0.04 }) + 0.1 }}
        />
      </div>
      <span className="w-12 text-right font-mono text-micro text-zinc-400">{count.toLocaleString()}</span>
    </m.div>
  );
}

export default function DashboardStats({ stats, pulse, loading }) {
  if (loading || !stats) return null;

  const topShapes = (stats.top_shapes || []).slice(0, 6);
  const topStates = (stats.top_states || []).slice(0, 6);
  const maxShapeCount = topShapes[0]?.count || 1;
  const maxStateCount = topStates[0]?.count || 1;

  const dateRange = stats.date_range || {};
  const minYear = dateRange.min ? new Date(dateRange.min).getFullYear() : "?";
  const maxYear = dateRange.max ? new Date(dateRange.max).getFullYear() : "?";

  return (
    <div className="space-y-3">
      {/* Top stats row */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard label="Total Sightings" index={0} accent>
          <CountUpNumber
            value={pulse?.total || stats.total_sightings || 0}
            className="font-display text-lg font-bold text-zinc-100 sm:text-2xl"
          />
        </StatCard>

        <StatCard label="Geocoded" index={1}>
          <div className="flex items-baseline gap-2">
            <CountUpNumber
              value={stats.geocoded_sightings || 0}
              className="font-display text-lg font-bold text-zinc-100 sm:text-2xl"
            />
            <span className="font-mono text-caption text-amber-400">
              {pulse?.geocodedPct || "0"}%
            </span>
          </div>
        </StatCard>

        <StatCard label="Date Range" index={2}>
          <p className="font-display text-lg font-bold text-zinc-100 sm:text-xl">
            {minYear}<span className="mx-1 text-zinc-500">-</span>{maxYear}
          </p>
          <p className="mt-0.5 text-micro text-zinc-500 hidden sm:block">{maxYear - minYear}+ years</p>
        </StatCard>

        <StatCard label="Most Common" index={3}>
          <div className="flex items-center gap-2">
            <ShapeIcon shape={topShapes[0]?.shape} size={20} className="text-amber-400" />
            <p className="font-display text-base font-bold capitalize text-zinc-100 sm:text-xl">
              {topShapes[0]?.shape || "n/a"}
            </p>
          </div>
          <p className="mt-0.5 font-mono text-micro text-zinc-500">{(topShapes[0]?.count || 0).toLocaleString()} reports</p>
        </StatCard>
      </div>

      {/* Charts row — hidden on very small mobile */}
      <div className="hidden grid-cols-1 gap-2 sm:grid sm:gap-3 lg:grid-cols-2">
        {/* Top shapes */}
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.smooth, delay: 0.15 }}
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">Top Shapes</p>
            <span className="font-mono text-[9px] text-zinc-600">{topShapes.length} shown</span>
          </div>
          <div className="space-y-2">
            {topShapes.map((s, i) => (
              <TopShapeBar key={s.shape} shape={s.shape} count={s.count} maxCount={maxShapeCount} index={i} />
            ))}
          </div>
        </m.div>

        {/* Top states */}
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.smooth, delay: 0.2 }}
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">Top States</p>
            <span className="font-mono text-[9px] text-zinc-600">{topStates.length} shown</span>
          </div>
          <div className="space-y-2">
            {topStates.map((s, i) => (
              <TopStateBar key={s.state} state={s.state} count={s.count} maxCount={maxStateCount} index={i} />
            ))}
          </div>
        </m.div>
      </div>
    </div>
  );
}
