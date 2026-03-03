import { m } from "motion/react";
import { springs } from "../../lib/motion";
import CountUpNumber from "../shared/CountUpNumber";

const NAV_ITEMS = [
  { id: "explore", label: "Explore", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  )},
  { id: "compare", label: "Compare", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
  )},
  { id: "sampling", label: "Sampling", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  )},
];

export default function Sidebar({ collapsed, mode, pulse, onModeChange, onSampling }) {
  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/[0.06] bg-surface-deepest/95 backdrop-blur-xl transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-[240px]"
      } hidden md:flex`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 border-b border-white/[0.06] px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
        <div className="h-8 w-8 shrink-0 rotate-45 rounded-lg bg-gradient-to-br from-teal-300 to-cyan-500 shadow-[0_0_16px_rgba(94,234,212,0.3)]" />
        {!collapsed && (
          <span className="text-body font-semibold tracking-tight text-slate-100">
            Sky Ledger Atlas
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-2 pt-4">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === mode || (item.id === "explore" && mode === "explore");
          const handleClick = () => {
            if (item.id === "sampling") {
              onSampling();
            } else {
              onModeChange(item.id);
            }
          };
          return (
            <m.button
              key={item.id}
              type="button"
              onClick={handleClick}
              whileTap={{ scale: 0.97 }}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-caption font-medium transition-colors ${
                isActive
                  ? "text-accent"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              } ${collapsed ? "justify-center" : ""}`}
            >
              {isActive && (
                <m.div
                  className="absolute inset-0 rounded-lg bg-accent-muted"
                  layoutId="sidebar-active"
                  transition={springs.snappy}
                />
              )}
              <span className="relative">{item.icon}</span>
              {!collapsed && <span className="relative">{item.label}</span>}
            </m.button>
          );
        })}
      </nav>

      {/* Pulse Stats */}
      {!collapsed && pulse && (
        <div className="mt-auto border-t border-white/[0.06] p-4">
          <p className="text-micro font-medium uppercase tracking-[0.06em] text-slate-500 mb-3">Dataset Pulse</p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-micro text-slate-500">Total</span>
              <CountUpNumber value={pulse.total} className="text-caption font-semibold text-slate-200" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-micro text-slate-500">Slice</span>
              <CountUpNumber value={pulse.slice} className="text-caption font-semibold text-slate-200" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-micro text-slate-500">Geocoded</span>
              <span className="text-caption font-semibold text-accent">{pulse.geocodedPct}%</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
