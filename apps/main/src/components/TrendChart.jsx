import React from "react";
import { wellbeingMetrics } from "../lib/wellbeing.mjs";
export default function TrendChart({ series, metric }) {
  const config = wellbeingMetrics[metric], values = series.filter((d) => Number.isFinite(d[metric]));
  if (!values.length) return <div className="trend-empty">No {config.label.toLowerCase()} records in this period. A check-in or food log will start this chart.</div>;
  const width = 720, height = 220, left = 42, top = 16, plotWidth = 660, plotHeight = 160;
  const max = Math.max(config.maximum, ...values.map((d) => d[metric]));
  const x = (index) => left + index / Math.max(1, series.length - 1) * plotWidth;
  const y = (value) => top + plotHeight - value / max * plotHeight;
  const segments = []; let segment = [];
  series.forEach((row, index) => {
    if (Number.isFinite(row[metric])) segment.push(`${x(index)},${y(row[metric])}`);
    else if (segment.length) { segments.push(segment); segment = []; }
  });
  if (segment.length) segments.push(segment);
  return <div className="trend-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${config.label} across ${series.length} days. ${values.length} recorded days; gaps are unrecorded days.`}>
      {[0, 0.5, 1].map((fraction) => <g key={fraction}><line x1={left} x2={left + plotWidth} y1={y(max * fraction)} y2={y(max * fraction)} stroke="#dfe5d8" /><text x={left - 9} y={y(max * fraction) + 4} textAnchor="end">{Math.round(max * fraction * 10) / 10}</text></g>)}
      {segments.map((points, i) => <polyline key={i} points={points.join(" ")} fill="none" stroke={config.colour} strokeWidth={3} />)}
      {series.map((d, i) => Number.isFinite(d[metric]) && <circle key={d.date} cx={x(i)} cy={y(d[metric])} r={4} fill={config.colour}><title>{d.date}: {Math.round(d[metric] * 10) / 10} {config.unit}{d[metric + "Partial"] ? " · partial nutrition data" : ""}</title></circle>)}
      <text x={left} y={height - 15}>{series[0].date}</text><text x={left + plotWidth} y={height - 15} textAnchor="end">{series.at(-1).date}</text>
    </svg>
    <p className="form-hint">Dots are recorded days. Gaps mean no data. {metric === "protein" || metric === "fiber" ? "Food values reflect recorded intake only; missing nutrients and unlogged meals can make totals incomplete." : "These are your own observations, not a health assessment."}</p>
  </div>;
}
