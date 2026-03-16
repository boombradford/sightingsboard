import { m } from "motion/react";
import { fadeUp } from "../../lib/motion";
import RadarSweep from "./RadarSweep";

export default function EmptyState({ icon, title, description, action, variant = "default" }) {
  const showRadar = variant === "radar" || !icon;

  return (
    <m.div
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      variants={fadeUp}
      initial="hidden"
      animate="visible"
    >
      {showRadar ? (
        <div className="mb-4 opacity-40">
          <RadarSweep size={72} />
        </div>
      ) : icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-2xl text-zinc-500">
          {icon}
        </div>
      ) : null}
      {title && <h3 className="text-body font-semibold text-zinc-200 mb-1.5">{title}</h3>}
      {description && <p className="text-caption text-zinc-400 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </m.div>
  );
}
