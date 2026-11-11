"use client";

import { useEffect, useRef, useState } from "react";
import { compactNumber } from "@/lib/utils";

type Point = { day: string; n: number };

const H = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 36 };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => v / s <= 4) ?? 10 * pow;
  return Math.ceil(v / step) * step;
}

function label(day: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-US", opts);
}

/** Daily views as a single line with a soft area fill, hover crosshair and a table for screen readers. */
export function ViewsChart({ data }: { data: Point[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(0, ...data.map((d) => d.n)));
  const iw = w - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * iw : iw / 2);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.n).toFixed(1)}`).join("");
  const area = `${line}L${x(data.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const ticks = [0, max / 2, max];
  const xTicks = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={wrap} className="relative w-full">
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        role="img"
        aria-label={`Views per day for the last ${data.length} days`}
        className="block max-w-full touch-none"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * w;
          const i = Math.round(((px - PAD.left) / iw) * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular-nums">
              {compactNumber(t)}
            </text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            fontSize={11}
            fill="var(--muted)"
          >
            {label(data[i].day)}
          </text>
        ))}
        <path d={area} fill="var(--accent)" fillOpacity={0.12} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* Emphasised endpoint: today */}
        <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].n)} r={4} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />
        {h ? (
          <g pointerEvents="none">
            <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover!)} cy={y(h.n)} r={5} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />
          </g>
        ) : null}
      </svg>
      {h ? (
        <div
          className="pointer-events-none absolute top-0 rounded-md border border-line bg-bg px-3 py-2 text-xs shadow-card"
          style={{ left: Math.min(Math.max(x(hover!) - 60, 0), w - 120), width: 120 }}
        >
          <p className="text-muted">{label(h.day, { weekday: "short", month: "short", day: "numeric" })}</p>
          <p className="font-semibold tabular-nums text-fg">
            {h.n.toLocaleString()} {h.n === 1 ? "view" : "views"}
          </p>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>Views per day</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Views</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{label(d.day, { month: "long", day: "numeric" })}</td>
              <td>{d.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
