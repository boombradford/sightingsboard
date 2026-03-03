import { m } from "motion/react";
import { buttonMotion } from "../../lib/motion";

export default function TopBar({ children, actions }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] bg-surface-deepest/80 px-5 py-2.5 backdrop-blur-xl">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
        {children}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
