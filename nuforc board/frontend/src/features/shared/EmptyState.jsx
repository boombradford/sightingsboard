import { m } from "motion/react";
import { fadeUp } from "../../lib/motion";

export default function EmptyState({ icon, title, description, action }) {
  return (
    <m.div
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      variants={fadeUp}
      initial="hidden"
      animate="visible"
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] text-2xl text-slate-500">
          {icon}
        </div>
      )}
      {title && <h3 className="text-body font-semibold text-slate-200 mb-1.5">{title}</h3>}
      {description && <p className="text-caption text-slate-500 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </m.div>
  );
}
