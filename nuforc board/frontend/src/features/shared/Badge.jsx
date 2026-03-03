import { m } from "motion/react";
import { springs } from "../../lib/motion";

const variants = {
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  danger: "border-rose-500/20 bg-rose-500/10 text-rose-400",
  info: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  neutral: "border-white/[0.08] bg-white/[0.04] text-slate-300",
  accent: "border-accent/20 bg-accent-muted text-accent",
};

export default function Badge({ variant = "neutral", children, animate = false }) {
  const cls = `inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-micro font-medium ${variants[variant] || variants.neutral}`;

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
