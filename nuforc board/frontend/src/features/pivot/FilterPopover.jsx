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
          className={`absolute top-full z-50 mt-2 w-72 surface-card p-4 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={springs.snappy}
        >
          {title && (
            <p className="mb-3 text-micro font-medium uppercase tracking-[0.06em] text-slate-500">{title}</p>
          )}
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
