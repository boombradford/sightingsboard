import { useMemo, useState } from "react";
import { m } from "motion/react";
import { Pie } from "@visx/shape";
import { Group } from "@visx/group";
import { springs, stagger } from "../../lib/motion";

const COLORS = [
  "rgba(94, 234, 212, 0.8)",
  "rgba(96, 165, 250, 0.7)",
  "rgba(251, 191, 36, 0.7)",
  "rgba(251, 113, 133, 0.7)",
  "rgba(167, 139, 250, 0.7)",
  "rgba(52, 211, 153, 0.6)",
  "rgba(148, 163, 184, 0.4)",
];

export default function DonutChart({
  data = [],
  width = 200,
  height = 200,
  innerRadius = 55,
  keyField = "key",
  valueField = "count",
  centerLabel,
  centerValue,
}) {
  const [hovered, setHovered] = useState(null);
  const radius = Math.min(width, height) / 2 - 4;

  const sortedData = useMemo(
    () => [...data].sort((a, b) => Number(b[valueField] || 0) - Number(a[valueField] || 0)).slice(0, 7),
    [data, valueField]
  );

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={width} height={height}>
        <Group top={height / 2} left={width / 2}>
          <Pie
            data={sortedData}
            pieValue={(d) => Number(d[valueField] || 0)}
            outerRadius={radius}
            innerRadius={innerRadius}
            padAngle={0.02}
            cornerRadius={3}
          >
            {(pie) =>
              pie.arcs.map((arc, i) => {
                const key = String(sortedData[i]?.[keyField] ?? i);
                const isHovered = hovered === key;
                return (
                  <m.path
                    key={key}
                    d={pie.path(arc) || ""}
                    fill={COLORS[i % COLORS.length]}
                    initial={{ opacity: 0, pathLength: 0 }}
                    animate={{
                      opacity: 1,
                      pathLength: 1,
                      scale: isHovered ? 1.05 : 1,
                    }}
                    transition={{ ...springs.smooth, delay: stagger(i, { delay: 0.06 }) }}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: "pointer", transformOrigin: "center" }}
                  />
                );
              })
            }
          </Pie>
          {/* Center text */}
          {centerValue !== undefined && (
            <>
              <text textAnchor="middle" dy={-4} fill="#f1f5f9" fontSize={18} fontWeight={600} fontFamily="var(--font-body)">
                {centerValue}
              </text>
              {centerLabel && (
                <text textAnchor="middle" dy={14} fill="rgba(148,163,184,0.6)" fontSize={9} fontFamily="var(--font-mono)">
                  {centerLabel}
                </text>
              )}
            </>
          )}
        </Group>
      </svg>
      {/* Legend */}
      {hovered && (
        <m.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-1 text-micro text-slate-300"
        >
          {hovered}: {sortedData.find((d) => String(d[keyField]) === hovered)?.[valueField] || 0}
        </m.p>
      )}
    </div>
  );
}
