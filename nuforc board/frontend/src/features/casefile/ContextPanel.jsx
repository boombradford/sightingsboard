import Badge from "../shared/Badge";

function ContextRow({ icon, label, value, badge }) {
  if (value == null && !badge) return null;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex items-center gap-2 text-caption text-zinc-300">
        <span className="w-4 text-center text-zinc-500">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value != null && (
          <span className="font-mono text-caption text-zinc-200">{value}</span>
        )}
        {badge}
      </div>
    </div>
  );
}

function weatherBadge(cloudCover) {
  if (cloudCover == null) return null;
  if (cloudCover <= 25) return <Badge variant="success">Clear</Badge>;
  if (cloudCover <= 60) return <Badge variant="warning">Partly cloudy</Badge>;
  return <Badge variant="danger">Overcast</Badge>;
}

function baseBadge(km) {
  if (km == null) return null;
  if (km <= 30) return <Badge variant="warning">Very close</Badge>;
  if (km <= 80) return <Badge variant="info">Nearby</Badge>;
  return <Badge variant="neutral">{Math.round(km)} km</Badge>;
}

function kpBadge(kp) {
  if (kp == null) return null;
  if (kp >= 7) return <Badge variant="danger">Severe storm</Badge>;
  if (kp >= 5) return <Badge variant="warning">Storm</Badge>;
  if (kp >= 3) return <Badge variant="info">Unsettled</Badge>;
  return <Badge variant="neutral">Quiet</Badge>;
}

export default function ContextPanel({ context }) {
  if (!context) return null;

  const hasAny =
    context.cloud_cover_pct != null ||
    context.nearest_base_name ||
    context.fireball_match_date ||
    context.kp_index != null;

  if (!hasAny) return null;

  return (
    <div className="space-y-0.5 divide-y divide-zinc-800/50">
      <ContextRow
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 15h4l3-9 4 18 3-9h6" />
          </svg>
        }
        label="Weather"
        value={
          context.cloud_cover_pct != null
            ? `${Math.round(context.cloud_cover_pct)}% cloud`
            : null
        }
        badge={weatherBadge(context.cloud_cover_pct)}
      />

      <ContextRow
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
            <line x1="12" y1="22" x2="12" y2="15.5" />
            <polyline points="22 8.5 12 15.5 2 8.5" />
          </svg>
        }
        label="Nearest Base"
        value={
          context.nearest_base_name
            ? `${context.nearest_base_name} (${Math.round(context.nearest_base_km)} km)`
            : null
        }
        badge={baseBadge(context.nearest_base_km)}
      />

      <ContextRow
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <line x1="2" y1="12" x2="22" y2="12" />
          </svg>
        }
        label="Fireball Match"
        value={context.fireball_match_date || null}
        badge={
          context.fireball_match_date ? (
            <Badge variant="warning">
              {context.fireball_distance_km != null
                ? `${Math.round(context.fireball_distance_km)} km`
                : "Match"}
            </Badge>
          ) : null
        }
      />

      <ContextRow
        icon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 3v1m0 16v1m8.66-13.5l-.87.5M4.21 16l-.87.5m17.32 0l-.87-.5M4.21 8l-.87-.5M21 12h-1M4 12H3" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        }
        label="Kp Index"
        value={context.kp_index != null ? context.kp_index.toFixed(1) : null}
        badge={kpBadge(context.kp_index)}
      />
    </div>
  );
}
