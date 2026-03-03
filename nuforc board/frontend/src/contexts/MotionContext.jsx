import { createContext, useContext, useMemo } from "react";
import { useReducedMotion } from "motion/react";
import { springs } from "../lib/motion";

const MotionContext = createContext(null);

export function MotionProvider({ children }) {
  const shouldReduceMotion = useReducedMotion();
  const config = useMemo(() => ({
    reducedMotion: shouldReduceMotion,
    transition: shouldReduceMotion ? { duration: 0 } : springs.smooth,
    springs,
  }), [shouldReduceMotion]);

  return (
    <MotionContext.Provider value={config}>
      {children}
    </MotionContext.Provider>
  );
}

export function useMotionConfig() {
  const ctx = useContext(MotionContext);
  if (!ctx) throw new Error("useMotionConfig must be used within MotionProvider");
  return ctx;
}
