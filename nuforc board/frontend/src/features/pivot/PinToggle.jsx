import { m } from "framer-motion";

export default function PinToggle({ pinned, onToggle }) {
  return (
    <m.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onToggle}
      className={`rounded-full border px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] ${
        pinned
          ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100"
          : "border-slate-400/45 bg-slate-900/70 text-slate-200"
      }`}
    >
      {pinned ? "Pinned" : "Pin"}
    </m.button>
  );
}
