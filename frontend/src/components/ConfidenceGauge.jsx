import React from "react";

function ConfidenceGauge({ value, size = 140, strokeWidth = 10, color }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="gauge-container">
      <svg className="gauge-svg" width={size} height={size}>
        <circle
          className="gauge-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          stroke="var(--bg-tertiary)"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
        <g className="gauge-text-group" transform={`rotate(90, ${size / 2}, ${size / 2})`}>
          <text className="gauge-text" x={size / 2} y={size / 2 - 6}>
            {value}%
          </text>
          <text className="gauge-label" x={size / 2} y={size / 2 + 14}>
            Confidence
          </text>
        </g>
      </svg>
    </div>
  );
}

export default ConfidenceGauge;
