import { m } from "motion/react";
import { springs } from "../../lib/motion";

export default function DetailPanel({ children, visible = true }) {
  return (
    <m.aside
      className={`hidden h-screen w-[380px] shrink-0 flex-col border-l border-white/[0.06] bg-surface-deepest/90 backdrop-blur-xl xl:flex ${
        visible ? "" : "xl:hidden"
      }`}
      initial={false}
      animate={{ width: visible ? 380 : 0, opacity: visible ? 1 : 0 }}
      transition={springs.smooth}
    >
      <div className="flex h-full flex-col overflow-y-auto">
        {children}
      </div>
    </m.aside>
  );
}
