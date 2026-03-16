import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef } from "react";
import { springs } from "../../lib/motion";

export default function Modal({ open, onClose, title, children, width = "max-w-lg" }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />
          <m.div
            ref={panelRef}
            className={`relative ${width} w-full rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-elevated`}
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 3 }}
            transition={springs.snappy}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {title && (
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-heading font-semibold text-zinc-100">{title}</h2>
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
