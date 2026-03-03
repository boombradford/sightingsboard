import { AnimatePresence, m } from "motion/react";
import { springs } from "../../lib/motion";

export default function ChartTooltip({ x, y, visible, children }) {
  return (
    <AnimatePresence>
      {visible && (
        <m.div
          className="pointer-events-none absolute z-50 rounded-lg border border-white/[0.08] bg-surface-elevated px-2.5 py-1.5 text-micro text-slate-200 shadow-lg"
          style={{ left: x, top: y, transform: "translate(-50%, -100%) translateY(-8px)" }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={springs.snappy}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
