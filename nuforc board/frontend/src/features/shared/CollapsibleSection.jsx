import { useState } from "react";
import { AnimatePresence, m } from "motion/react";

export default function CollapsibleSection({ title, defaultOpen = false, children, badge }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-zinc-800/40"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-zinc-500 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <span className="font-mono text-micro uppercase tracking-wider text-zinc-400">{title}</span>
        {badge != null && (
          <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-micro text-zinc-500">{badge}</span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-zinc-800/50 p-3">
              {children}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
