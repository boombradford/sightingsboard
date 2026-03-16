import { m } from "motion/react";
import { springs } from "../../lib/motion";
import { getModeAccent } from "../../lib/modeTheme";
import CountUpNumber from "../shared/CountUpNumber";

const NAV_ITEMS = [
  { id: "explore", label: "Explore", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  )},
  { id: "compare", label: "Compare", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
  )},
  { id: "pipeline", label: "Pipeline", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )},
  { id: "discover", label: "Discover", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )},
  { id: "sampling", label: "Sampling", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  )},
];

export default function Sidebar({ collapsed, mode, pulse, onModeChange, onSampling }) {
  const accent = getModeAccent(mode);

  return (
    <>
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-zinc-800 bg-zinc-950 transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-[220px]"
      } hidden md:flex`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 border-b border-zinc-800 px-4 py-3 ${collapsed ? "justify-center" : ""}`}>
        <div className="shrink-0">
          <svg width="34" height="34" viewBox="0 0 120 120" fill="none">
            {/* Saucer body — tilted disc */}
            <ellipse cx="60" cy="58" rx="38" ry="10" stroke="#e0e0e0" strokeWidth="1.8" fill="none" transform="rotate(-8 60 58)" />
            {/* Dome */}
            <path d="M44 52 Q52 38, 60 36 Q68 38, 76 52" stroke="#e0e0e0" strokeWidth="1.8" fill="none" strokeLinecap="round" transform="rotate(-8 60 58)" />
            {/* Orbital ring — larger, tilted opposite */}
            <ellipse cx="60" cy="58" rx="52" ry="16" stroke="#e0e0e0" strokeWidth="1.2" fill="none" transform="rotate(15 60 58)" />
          </svg>
        </div>
        {!collapsed && (
          <span className="text-[15px] font-semibold tracking-[0.22em] uppercase text-white" style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
            Sky Ledger
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-2 pt-4">
        <p className={`mb-2 px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500 ${collapsed ? "hidden" : ""}`}>
          Navigation
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === mode || (item.id === "explore" && mode === "explore");
          const itemAccent = getModeAccent(item.id === "sampling" ? mode : item.id);
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
              whileTap={{ scale: 0.98 }}
              className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-caption font-medium transition-colors ${
                isActive
                  ? ""
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              } ${collapsed ? "justify-center" : ""}`}
              style={isActive ? { color: itemAccent.accent } : undefined}
            >
              {isActive && (
                <m.div
                  className="absolute inset-0 rounded-md"
                  style={{
                    borderWidth: 1,
                    borderColor: itemAccent.muted,
                    backgroundColor: `color-mix(in srgb, ${itemAccent.accent} 8%, transparent)`,
                  }}
                  layoutId="sidebar-active"
                  transition={springs.snappy}
                />
              )}
              {isActive && (
                <m.div
                  className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: itemAccent.accent }}
                  layoutId="sidebar-indicator"
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
        <div className="mt-auto border-t border-zinc-800 p-4">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">Dataset Pulse</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded-md bg-zinc-800/50 px-3 py-2">
              <span className="text-micro text-zinc-400">Total</span>
              <CountUpNumber value={pulse.total} className="font-mono text-caption font-semibold text-zinc-200" />
            </div>
            <div className="flex items-center justify-between rounded-md bg-zinc-800/50 px-3 py-2">
              <span className="text-micro text-zinc-400">Slice</span>
              <CountUpNumber value={pulse.slice} className="font-mono text-caption font-semibold text-zinc-200" />
            </div>
            <div className="flex items-center justify-between rounded-md border border-amber-500/10 bg-amber-500/[0.04] px-3 py-2">
              <span className="flex items-center gap-1.5 text-micro text-zinc-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                </span>
                Geocoded
              </span>
              <span className="font-mono text-caption font-semibold text-amber-400">{pulse.geocodedPct}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Version tag */}
      {!collapsed && (
        <div className="border-t border-zinc-800/50 px-4 py-2.5">
          <span className="font-mono text-[9px] text-zinc-600">v0.2.0-alpha</span>
        </div>
      )}
    </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-sm md:hidden">
        {NAV_ITEMS.filter((item) => item.id !== "sampling").map((item) => {
          const isActive = item.id === mode;
          const itemAccent = getModeAccent(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => item.id === "sampling" ? onSampling() : onModeChange(item.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? "" : "text-zinc-500"
              }`}
              style={isActive ? { color: itemAccent.accent } : undefined}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
