import { m } from "motion/react";
import { springs } from "../../lib/motion";

export default function ScoreGauge({ score = 0, size = 52 }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const dashOffset = circumference * (1 - pct);

  const color = score >= 60 ? "rgb(245, 158, 11)" : score >= 30 ? "rgb(161, 161, 170)" : "rgb(63, 63, 70)";
  const trackColor = "rgba(63, 63, 70, 0.5)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth="3"
        />
        {/* Value arc */}
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ ...springs.smooth, delay: 0.2 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-mono text-micro font-bold"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}
