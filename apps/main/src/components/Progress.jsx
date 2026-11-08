import React from "react";
export default function Progress({ value, max }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.max(max, Math.round(value))}
      aria-label="Daily goal progress"
    >
      <span style={{ width: Math.min(100, (value / max) * 100) + "%" }} />
    </div>
  );
}
