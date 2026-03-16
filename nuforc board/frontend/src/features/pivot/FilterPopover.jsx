import { useEffect, useRef } from "react";
import { AnimatePresence, m } from "motion/react";
import { springs } from "../../lib/motion";

export default function FilterPopover({ open, onClose, title, children, align = "left" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          ref={ref}
          className={`absolute top-full z-50 mt-2 w-72 rounded-lg border border-zinc-800 bg-zinc-900 p-4 shadow-elevated ${
            align === "right" ? "right-0" : "left-0"
          }`}
          initial={{ opacity: 0, y: -3, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -3, scale: 0.98 }}
          transition={springs.snappy}
        >
          {title && (
            <p className="mb-3 font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-zinc-400">{title}</p>
          )}
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
