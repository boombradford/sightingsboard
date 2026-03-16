import { m } from "motion/react";
import { springs } from "../../lib/motion";
import CountUpNumber from "../shared/CountUpNumber";
import RadarSweep from "../shared/RadarSweep";

export default function HeroBanner({ total = 0 }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.smooth}
      className="relative overflow-hidden rounded-lg border border-amber-500/10 bg-gradient-to-r from-amber-500/[0.04] via-transparent to-indigo-500/[0.03] p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <CountUpNumber
              value={total}
              className="font-display text-3xl font-bold text-zinc-100 sm:text-4xl"
            />
            <span className="hidden font-mono text-micro uppercase tracking-wider text-zinc-500 sm:inline">
              witness reports
            </span>
          </div>
          <p className="mt-1 text-caption text-zinc-500 sm:text-body sm:text-zinc-400">
            Every sighting scored, catalogued, and searchable.
          </p>
        </div>
        <div className="hidden opacity-60 sm:block">
          <RadarSweep size={64} />
        </div>
      </div>
    </m.div>
  );
}
