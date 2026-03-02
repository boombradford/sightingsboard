import { m } from "framer-motion";
import { buttonMotion, sectionVariants } from "../lib/animations";

export default function HeroHeader({ menuOpen, onToggleMenu }) {
  return (
    <m.header
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      className="glass-card p-4 sm:p-5"
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="space-y-2">
          <p className="panel-title">NUFORC Intelligence Board</p>
          <h1 className="font-display text-5xl leading-[0.9] text-slate-50 sm:text-6xl">Sky Ledger Atlas</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Search and compare decades of sighting reports. Pivot by shape, place, and date,
            then sample random events to spot recurring patterns.
          </p>
        </div>
        <div className="grid gap-2 xl:justify-items-end">
          <div className="grid gap-2 sm:grid-cols-3 xl:justify-items-end">
            <span className="chip text-center">Live SQLite Feed</span>
            <span className="chip text-center">Evidence-Linked Cases</span>
            <span className="chip text-center">Rapid Query Mode</span>
          </div>
          <m.button
            type="button"
            {...buttonMotion}
            onClick={onToggleMenu}
            aria-expanded={menuOpen}
            aria-controls="mobile-filter-drawer"
            className="chip inline-flex items-center gap-2 xl:hidden"
          >
            <span
              aria-hidden="true"
              className="inline-block h-3 w-4 border-y-2 border-current before:relative before:top-[4px] before:block before:border-t-2 before:border-current before:content-['']"
            />
            {menuOpen ? "Hide menu" : "Open menu"}
          </m.button>
        </div>
      </div>
    </m.header>
  );
}
