import { useEffect, useState, useRef } from "react";
import { m, useSpring, useTransform } from "motion/react";

export default function CountUpNumber({ value, duration = 0.8, decimals = 0, className = "" }) {
  const spring = useSpring(0, { stiffness: 100, damping: 20 });
  const [display, setDisplay] = useState("0");
  const prevValue = useRef(0);

  useEffect(() => {
    const num = typeof value === "number" ? value : parseFloat(value) || 0;
    spring.set(num);
    prevValue.current = num;
  }, [value, spring]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (v) => {
      if (decimals > 0) {
        setDisplay(v.toFixed(decimals));
      } else {
        setDisplay(Math.round(v).toLocaleString());
      }
    });
    return unsubscribe;
  }, [spring, decimals]);

  return <span className={className}>{display}</span>;
}
