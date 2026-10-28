import React from "react";

const COLORS = ["#2563EB", "#16A34A", "#F59E0B", "#DC2626", "#7C3AED", "#0891B2"];

export function DonutChart({ data, size = 150, label = "" }) {
  const total = data.reduce((sum, item) => sum + Math.max(0, Number(item.value) || 0), 0);
  let offset = 0;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="metrics-chart" aria-label={label || "Donut chart"}>
      <svg viewBox="0 0 120 120" width={size} height={size} role="img">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="18" />
        {total > 0 && data.map((item, index) => {
          const value = Math.max(0, Number(item.value) || 0);
          const length = (value / total) * circumference;
          const circle = (
            <circle
              key={item.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={item.color || COLORS[index % COLORS.length]}
              strokeWidth="18"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += length;
          return circle;
        })}
        <text x="60" y="57" textAnchor="middle" className="metrics-chart-total">{total}</text>
        <text x="60" y="72" textAnchor="middle" className="metrics-chart-caption">total</text>
      </svg>
      <div className="metrics-chart-legend">
        {data.map((item, index) => (
          <span key={item.label}>
            <i style={{ background: item.color || COLORS[index % COLORS.length] }} />
            {item.label}: {item.value}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({ data, label = "" }) {
  const max = Math.max(...data.map((item) => Number(item.value) || 0), 1);
  return (
    <div className="metrics-bar-chart" aria-label={label || "Bar chart"}>
      {data.map((item, index) => (
        <div className="metrics-bar-row" key={item.label}>
          <span className="metrics-bar-label">{item.label}</span>
          <div className="metrics-bar-track">
            <span style={{ width: `${((Number(item.value) || 0) / max) * 100}%`, background: item.color || COLORS[index % COLORS.length] }} />
          </div>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
