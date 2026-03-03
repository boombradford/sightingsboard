import { useMemo, useState, useCallback } from "react";
import { m } from "motion/react";
import { scaleLinear, scaleTime } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { Group } from "@visx/group";
import { LinearGradient } from "@visx/gradient";
import { springs } from "../../lib/motion";
import ChartTooltip from "./ChartTooltip";

const MARGIN = { top: 12, right: 12, bottom: 24, left: 12 };

export default function InteractiveTimeline({
  data = [],
  width = 600,
  height = 140,
  dateField = "date",
  valueField = "count",
  onBrush,
}) {
  const [tooltip, setTooltip] = useState(null);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const parsedData = useMemo(() => {
    return data
      .map((d) => ({
        date: new Date(d[dateField]),
        value: Number(d[valueField] || 0),
        raw: d,
      }))
      .filter((d) => !isNaN(d.date.getTime()))
      .sort((a, b) => a.date - b.date);
  }, [data, dateField, valueField]);

  const xScale = useMemo(() => {
    if (!parsedData.length) return scaleTime({ domain: [new Date(), new Date()], range: [0, innerW] });
    return scaleTime({
      domain: [parsedData[0].date, parsedData[parsedData.length - 1].date],
      range: [0, innerW],
    });
  }, [parsedData, innerW]);

  const yScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, Math.max(...parsedData.map((d) => d.value), 1)],
        range: [innerH, 0],
        nice: true,
      }),
    [parsedData, innerH]
  );

  const handleMouseMove = useCallback(
    (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left - MARGIN.left;
      if (mx < 0 || mx > innerW) { setTooltip(null); return; }

      const date = xScale.invert(mx);
      let closest = parsedData[0];
      let minDist = Infinity;
      for (const d of parsedData) {
        const dist = Math.abs(d.date.getTime() - date.getTime());
        if (dist < minDist) { minDist = dist; closest = d; }
      }
      if (closest) {
        setTooltip({
          x: xScale(closest.date) + MARGIN.left,
          y: yScale(closest.value) + MARGIN.top,
          date: closest.date.toLocaleDateString(),
          value: closest.value,
        });
      }
    },
    [parsedData, xScale, yScale, innerW]
  );

  if (!parsedData.length) return null;

  return (
    <div className="relative">
      <svg
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <LinearGradient id="timeline-fill" from="rgba(94,234,212,0.15)" to="rgba(94,234,212,0)" />
        <Group left={MARGIN.left} top={MARGIN.top}>
          <AreaClosed
            data={parsedData}
            x={(d) => xScale(d.date)}
            y={(d) => yScale(d.value)}
            yScale={yScale}
            fill="url(#timeline-fill)"
          />
          <m.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={springs.gentle}
          >
            <LinePath
              data={parsedData}
              x={(d) => xScale(d.date)}
              y={(d) => yScale(d.value)}
              stroke="rgba(94,234,212,0.6)"
              strokeWidth={1.5}
            />
          </m.g>
          {/* Crosshair */}
          {tooltip && (
            <line
              x1={tooltip.x - MARGIN.left}
              y1={0}
              x2={tooltip.x - MARGIN.left}
              y2={innerH}
              stroke="rgba(94,234,212,0.2)"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )}
        </Group>
      </svg>
      <ChartTooltip x={tooltip?.x} y={tooltip?.y} visible={!!tooltip}>
        {tooltip && (
          <span>
            {tooltip.date}: <strong>{tooltip.value}</strong>
          </span>
        )}
      </ChartTooltip>
    </div>
  );
}
