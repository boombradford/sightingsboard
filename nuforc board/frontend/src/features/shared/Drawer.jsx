import { AnimatePresence, m } from "motion/react";
import { useEffect } from "react";
import { springs } from "../../lib/motion";

export default function Drawer({ open, onClose, title, children, side = "right", width = "w-[420px]" }) {
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

  const isRight = side === "right";

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-50 flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <m.div
            className={`relative ${width} h-full border-l border-zinc-800 bg-zinc-950 ${isRight ? "ml-auto" : "mr-auto"}`}
            initial={{ x: isRight ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: isRight ? "100%" : "-100%" }}
            transition={springs.sheet}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                {title && <h2 className="font-display text-body font-semibold text-zinc-100">{title}</h2>}
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
              <div className="flex-1 overflow-y-auto p-5">
                {children}
              </div>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
