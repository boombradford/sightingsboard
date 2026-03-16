import { AnimatePresence, m } from "motion/react";
import { springs } from "../../lib/motion";

export default function DetailPanel({ children, visible = true, onClose }) {
  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <m.div
            key="detail-backdrop"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Full-page panel */}
          <m.aside
            key="detail-panel"
            className="fixed inset-0 z-50 flex flex-col bg-zinc-950 shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-full sm:max-w-3xl sm:border-l sm:border-zinc-800"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={springs.smooth}
          >
            {/* Title bar */}
            <div className="flex items-center gap-2.5 border-b border-zinc-800 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="mr-1 rounded-md p-2.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 sm:p-1.5"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span className="font-display text-caption font-semibold text-zinc-200">Case File</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-green-500/80">Live</span>
                <kbd className="hidden rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-micro text-zinc-400 sm:inline-block">
                  Esc
                </kbd>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {children}
            </div>
          </m.aside>
        </>
      )}
    </AnimatePresence>
  );
}
