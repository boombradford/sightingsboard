export default function RadarSweep({ size = 80, className = "" }) {
  const r1 = size * 0.2;
  const r2 = size * 0.33;
  const r3 = size * 0.45;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        <circle cx={cx} cy={cy} r={r1} stroke="var(--mode-accent, rgb(245,158,11))" strokeWidth="0.5" opacity="0.15" />
        <circle cx={cx} cy={cy} r={r2} stroke="var(--mode-accent, rgb(245,158,11))" strokeWidth="0.5" opacity="0.10" />
        <circle cx={cx} cy={cy} r={r3} stroke="var(--mode-accent, rgb(245,158,11))" strokeWidth="0.5" opacity="0.07" />
        <circle cx={cx} cy={cy} r="2" fill="var(--mode-accent, rgb(245,158,11))" opacity="0.6" />
      </svg>
      <div
        className="radar-sweep-line absolute inset-0"
        style={{
          background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, var(--mode-accent-muted, rgba(245,158,11,0.10)) 30deg, transparent 60deg)`,
          borderRadius: "50%",
          animation: "radar-sweep 3s linear infinite",
        }}
      />
    </div>
  );
}
