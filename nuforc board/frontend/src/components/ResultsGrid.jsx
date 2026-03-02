import { AnimatePresence, m } from "framer-motion";
import { cardVariants } from "../lib/animations";
import { cx } from "../lib/format";
import SightingCard from "./SightingCard";

export default function ResultsGrid({ items, loading, aiBriefs, onGenerateBrief }) {
  return (
    <div
      className={cx(
        "grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-12 transition",
        loading && "opacity-55 saturate-75"
      )}
    >
      <AnimatePresence initial={false}>
        {items.length ? (
          items.map((item, index) => (
            <SightingCard
              key={item.sighting_id}
              item={item}
              index={index}
              brief={item.ai_brief || aiBriefs[item.sighting_id]}
              onGenerateBrief={onGenerateBrief}
            />
          ))
        ) : (
          <m.p
            key="empty-state"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="glass-card col-span-full rounded-2xl px-4 py-8 text-center text-sm text-slate-300"
          >
            {loading ? "Loading sightings..." : "No sightings match this filter set."}
          </m.p>
        )}
      </AnimatePresence>
    </div>
  );
}
