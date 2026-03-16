// ── Meridian motion system ──
// Precise, purposeful animations

export const springs = {
  snappy: { type: "spring", stiffness: 500, damping: 35 },
  smooth: { type: "spring", stiffness: 260, damping: 26 },
  gentle: { type: "spring", stiffness: 180, damping: 22 },
  sheet: { type: "spring", stiffness: 300, damping: 34 },
  bouncy: { type: "spring", stiffness: 400, damping: 18 },
  cinematic: { type: "spring", stiffness: 100, damping: 18 },
};

export const easeOut = [0.22, 1, 0.36, 1];

// ── Variant presets ──

export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: springs.smooth },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12, ease: easeOut } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: springs.gentle },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export const slideRight = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: springs.smooth },
  exit: { opacity: 0, x: 12, transition: { duration: 0.12, ease: easeOut } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: springs.snappy },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.1, ease: easeOut } },
};

export const panelBlur = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: springs.cinematic },
  exit: { opacity: 0, y: -3, transition: { duration: 0.15, ease: easeOut } },
};

export const toastEntry = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: springs.snappy },
  exit: { opacity: 0, y: -6, scale: 0.96, transition: { duration: 0.12, ease: easeOut } },
};

export const statusPulse = {
  animate: {
    scale: [1, 1.15, 1],
    opacity: [1, 0.7, 1],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
};

// ── Helpers ──

export function stagger(index, { delay = 0.025, max = 0.25 } = {}) {
  return Math.min(index * delay, max);
}

export function rowTransition(index = 0) {
  return {
    delay: stagger(index, { delay: 0.02, max: 0.2 }),
    ...springs.smooth,
  };
}

// ── Interaction presets ──

export const buttonMotion = {
  whileHover: { y: -0.5 },
  whileTap: { scale: 0.97, transition: springs.snappy },
};

export const cardHover = {
  whileHover: { y: -1, transition: springs.smooth },
};

export const chipBounce = {
  whileTap: { scale: 0.96, transition: springs.snappy },
};

// ── Card variants with stagger ──

export const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (index) => ({
    opacity: 1,
    y: 0,
    transition: {
      ...springs.smooth,
      delay: stagger(index),
    },
  }),
  exit: { opacity: 0, y: -6, transition: { duration: 0.12, ease: easeOut } },
};

export const sectionVariants = fadeUp;

// ── Backwards-compat aliases ──

export const iosSprings = springs;
export const iosPaneVariants = {
  initial: fadeUp.hidden,
  animate: fadeUp.visible,
  exit: fadeUp.exit,
};
