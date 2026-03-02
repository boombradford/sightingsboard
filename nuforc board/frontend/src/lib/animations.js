export const sectionVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 240, damping: 24 },
  },
};

export const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  visible: (index) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 290,
      damping: 26,
      delay: Math.min(index * 0.024, 0.24),
    },
  }),
  exit: { opacity: 0, y: -10, transition: { duration: 0.18 } },
};

export const buttonMotion = {
  whileHover: { y: -1, scale: 1.01 },
  whileTap: { scale: 0.97 },
};
