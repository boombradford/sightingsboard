import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { springs } from "../../lib/motion";

export default function Tooltip({ content, children, side = "top", className = "" }) {
  const [show, setShow] = useState(false);

  const positions = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && content && (
          <m.div
            className={`absolute z-50 ${positions[side]} pointer-events-none whitespace-nowrap rounded-lg border border-white/[0.08] bg-surface-elevated px-2.5 py-1.5 text-micro text-slate-200 shadow-lg`}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={springs.snappy}
            role="tooltip"
          >
            {content}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
