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
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <m.div
            className={`relative ml-auto ${width} h-full border-l border-white/[0.06] bg-surface-deepest/95 backdrop-blur-xl ${isRight ? "ml-auto" : "mr-auto"}`}
            initial={{ x: isRight ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: isRight ? "100%" : "-100%" }}
            transition={springs.sheet}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                {title && <h2 className="text-body font-semibold text-slate-100">{title}</h2>}
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200"
                  aria-label="Close"
                >
                  &#x2715;
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
