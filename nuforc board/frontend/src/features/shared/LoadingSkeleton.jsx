export default function LoadingSkeleton({ rows = 5, columns = 4, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: columns }, (_, c) => (
            <div
              key={c}
              className="h-8 flex-1 rounded-lg bg-white/[0.03] shimmer"
              style={{ animationDelay: `${(r * columns + c) * 0.06}s` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonLine({ width = "w-full", height = "h-4" }) {
  return <div className={`${width} ${height} rounded-md bg-white/[0.03] shimmer`} />;
}

export function SkeletonCard() {
  return (
    <div className="surface-card p-4 space-y-3">
      <div className="h-4 w-2/3 rounded-md bg-white/[0.04] shimmer" />
      <div className="h-3 w-full rounded-md bg-white/[0.03] shimmer" style={{ animationDelay: "0.1s" }} />
      <div className="h-3 w-4/5 rounded-md bg-white/[0.03] shimmer" style={{ animationDelay: "0.2s" }} />
    </div>
  );
}
