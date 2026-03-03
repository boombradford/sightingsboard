// ── Unified motion system ──
// Replaces iosMotion.js and animations.js

export const springs = {
  snappy: { type: "spring", stiffness: 500, damping: 30 },
  smooth: { type: "spring", stiffness: 300, damping: 28 },
  gentle: { type: "spring", stiffness: 200, damping: 24 },
  sheet: { type: "spring", stiffness: 280, damping: 32 },
  bouncy: { type: "spring", stiffness: 400, damping: 15 },
  cinematic: { type: "spring", stiffness: 120, damping: 20 },
};

export const easeOut = [0.22, 1, 0.36, 1];

// ── Variant presets ──

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: springs.smooth },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: easeOut } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: springs.gentle },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

export const slideRight = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: springs.smooth },
  exit: { opacity: 0, x: 16, transition: { duration: 0.15, ease: easeOut } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: springs.snappy },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: easeOut } },
};

// ── Helpers ──

export function stagger(index, { delay = 0.03, max = 0.3 } = {}) {
  return Math.min(index * delay, max);
}

export function rowTransition(index = 0) {
  return {
    delay: stagger(index, { delay: 0.03, max: 0.25 }),
    ...springs.smooth,
  };
}

// ── Interaction presets ──

export const buttonMotion = {
  whileHover: { y: -1, scale: 1.02 },
  whileTap: { scale: 0.96, transition: springs.snappy },
};

export const cardHover = {
  whileHover: { y: -2, transition: springs.smooth },
};

export const chipBounce = {
  whileTap: { scale: 0.95, transition: springs.snappy },
};

// ── Card variants with stagger ──

export const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: (index) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      ...springs.smooth,
      delay: stagger(index),
    },
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: easeOut } },
};

export const sectionVariants = fadeUp;

// ── Backwards-compat aliases ──

export const iosSprings = springs;
export const iosPaneVariants = {
  initial: fadeUp.hidden,
  animate: fadeUp.visible,
  exit: fadeUp.exit,
};
