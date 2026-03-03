export const iosEaseOut = [0.22, 1, 0.36, 1];

export const iosSprings = {
  snappy: {
    type: "spring",
    stiffness: 520,
    damping: 38,
    mass: 0.78,
  },
  smooth: {
    type: "spring",
    stiffness: 360,
    damping: 34,
    mass: 0.9,
  },
  sheet: {
    type: "spring",
    stiffness: 320,
    damping: 32,
    mass: 0.96,
  },
};

export const iosPaneVariants = {
  initial: { opacity: 0, y: 14, scale: 0.996 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: iosSprings.smooth,
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.996,
    transition: { duration: 0.2, ease: iosEaseOut },
  },
};

export function rowTransition(index = 0) {
  return {
    delay: Math.min(index * 0.012, 0.16),
    ...iosSprings.smooth,
  };
}
