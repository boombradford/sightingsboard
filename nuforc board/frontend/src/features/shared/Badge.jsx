import { m } from "motion/react";
import { springs } from "../../lib/motion";

const variants = {
  success: "border-green-500/20 bg-green-500/10 text-green-400",
  warning: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
  danger: "border-red-500/20 bg-red-500/10 text-red-400",
  info: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  neutral: "border-zinc-700 bg-zinc-800 text-zinc-300",
  accent: "border-amber-500/20 bg-amber-500/10 text-amber-400",
};

export default function Badge({ variant = "neutral", children, animate = false }) {
  const cls = `inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-micro font-medium ${variants[variant] || variants.neutral}`;

  if (animate) {
    return (
      <m.span
        className={cls}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springs.bouncy}
      >
        {children}
      </m.span>
    );
  }

  return <span className={cls}>{children}</span>;
}
