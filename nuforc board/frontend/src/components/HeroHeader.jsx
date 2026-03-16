import { m } from "motion/react";
import { buttonMotion, sectionVariants } from "../lib/motion";

export default function HeroHeader({ menuOpen, onToggleMenu }) {
  return (
    <m.header
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      className="glass-card p-6 sm:p-8"
    >
      <div className="mx-auto max-w-5xl space-y-6 text-center">
        <div className="space-y-3">
          <p className="panel-title">UFO Sightings Intelligence</p>
          <h1 className="font-display text-5xl leading-[0.9] text-slate-50 sm:text-6xl lg:text-7xl">Sky Ledger</h1>
          <p className="mx-auto max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Search and compare decades of sighting reports. Pivot by shape, place, and date,
            then sample random events to spot recurring patterns.
          </p>
        </div>
        <div className="mx-auto grid max-w-3xl gap-2 sm:grid-cols-3">
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
          className="chip inline-flex items-center justify-center gap-2 xl:hidden"
        >
          <span
            aria-hidden="true"
            className="inline-block h-3 w-4 border-y-2 border-current before:relative before:top-[4px] before:block before:border-t-2 before:border-current before:content-['']"
          />
          {menuOpen ? "Hide menu" : "Open menu"}
        </m.button>
      </div>
    </m.header>
  );
}
