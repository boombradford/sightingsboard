import { useMemo, useState } from "react";
import { m } from "motion/react";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { springs, stagger } from "../../lib/motion";
import ChartTooltip from "./ChartTooltip";

const MARGIN = { top: 8, right: 8, bottom: 28, left: 8 };

export default function AnimatedBarChart({
  data = [],
  width = 400,
  height = 200,
  selectedKey,
  keyField = "key",
  valueField = "count",
  accentColor = "rgba(94, 234, 212, 0.7)",
  barColor = "rgba(148, 163, 184, 0.25)",
}) {
  const [tooltip, setTooltip] = useState(null);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const xScale = useMemo(
    () =>
      scaleBand({
        domain: data.map((d) => String(d[keyField] ?? "")),
        range: [0, innerW],
        padding: 0.25,
      }),
    [data, keyField, innerW]
  );

  const yScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, Math.max(...data.map((d) => Number(d[valueField] || 0)), 1)],
        range: [innerH, 0],
        nice: true,
      }),
    [data, valueField, innerH]
  );

  return (
    <div className="relative">
      <svg width={width} height={height}>
        <Group left={MARGIN.left} top={MARGIN.top}>
          {data.map((d, i) => {
            const key = String(d[keyField] ?? "");
            const val = Number(d[valueField] || 0);
            const barX = xScale(key) || 0;
            const barW = xScale.bandwidth();
            const barH = innerH - (yScale(val) || 0);
            const isActive = selectedKey && selectedKey.toLowerCase() === key.toLowerCase();

            return (
              <m.rect
                key={key}
                x={barX}
                y={innerH}
                width={barW}
                rx={3}
                fill={isActive ? accentColor : barColor}
                initial={{ height: 0, y: innerH }}
                animate={{ height: barH, y: innerH - barH }}
                transition={{ ...springs.smooth, delay: stagger(i, { delay: 0.04 }) }}
                onMouseEnter={(e) => setTooltip({ x: barX + barW / 2 + MARGIN.left, y: innerH - barH + MARGIN.top, key, val })}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: "pointer" }}
              />
            );
          })}
          {/* X-axis labels */}
          {data.map((d) => {
            const key = String(d[keyField] ?? "");
            const x = (xScale(key) || 0) + xScale.bandwidth() / 2;
            return (
              <text
                key={`label-${key}`}
                x={x}
                y={innerH + 16}
                textAnchor="middle"
                fill="rgba(148, 163, 184, 0.5)"
                fontSize={9}
                fontFamily="var(--font-mono)"
              >
                {key.length > 6 ? key.slice(0, 5) + "..." : key}
              </text>
            );
          })}
        </Group>
      </svg>
      <ChartTooltip x={tooltip?.x} y={tooltip?.y} visible={!!tooltip}>
        {tooltip && (
          <span>
            <strong>{tooltip.key}:</strong> {tooltip.val}
          </span>
        )}
      </ChartTooltip>
    </div>
  );
}
