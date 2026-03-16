export const MODE_ACCENTS = {
  explore: {
    accent: "rgb(245, 158, 11)",
    muted: "rgba(245, 158, 11, 0.10)",
    glow: "rgba(245, 158, 11, 0.08)",
    ring: "rgba(245, 158, 11, 0.30)",
    tw: "amber",
  },
  compare: {
    accent: "rgb(167, 139, 250)",
    muted: "rgba(167, 139, 250, 0.10)",
    glow: "rgba(167, 139, 250, 0.08)",
    ring: "rgba(167, 139, 250, 0.30)",
    tw: "violet",
  },
  pipeline: {
    accent: "rgb(129, 140, 248)",
    muted: "rgba(129, 140, 248, 0.10)",
    glow: "rgba(129, 140, 248, 0.08)",
    ring: "rgba(129, 140, 248, 0.30)",
    tw: "indigo",
  },
  discover: {
    accent: "rgb(52, 211, 153)",
    muted: "rgba(52, 211, 153, 0.10)",
    glow: "rgba(52, 211, 153, 0.08)",
    ring: "rgba(52, 211, 153, 0.30)",
    tw: "emerald",
  },
};

export function getModeAccent(mode) {
  return MODE_ACCENTS[mode] || MODE_ACCENTS.explore;
}

export function modeStyleVars(mode) {
  const a = getModeAccent(mode);
  return {
    "--mode-accent": a.accent,
    "--mode-accent-muted": a.muted,
    "--mode-accent-glow": a.glow,
    "--mode-accent-ring": a.ring,
  };
}
