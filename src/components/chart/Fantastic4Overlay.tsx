"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/binance/types";
import { sma } from "@/lib/indicators";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface F4Box {
  startTime: number;
  endTime: number;
  top: number;
  bottom: number;
  state: "estrecho" | "contraido" | "normal" | "amplio" | "3f_contraido";
  date: string;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const STATE_STYLES: Record<F4Box["state"], { fill: string; border: string; label: string }> = {
  estrecho:       { fill: "rgba(144,238,144,0.15)", border: "#90ee90", label: "Estrecho" },
  contraido:      { fill: "rgba(38,166,154,0.15)",  border: "#26a69a", label: "Contraído" },
  normal:         { fill: "rgba(255,183,77,0.15)",  border: "#ffb74d", label: "Normal" },
  amplio:         { fill: "rgba(239,83,80,0.15)",   border: "#ef5350", label: "Amplio" },
  "3f_contraido": { fill: "rgba(171,71,188,0.15)",  border: "#ab47bc", label: "3F Contraídos" },
};

// ─── ET time helpers (mirrors rest.ts approach) ───────────────────────────────

const nyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "numeric",
  hour12: false,
});

const nyDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getNYTimeNum(unixSec: number): number {
  const parts = nyFormatter.formatToParts(new Date(unixSec * 1000));
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return h * 100 + m;
}

function getNYDateStr(unixSec: number): string {
  return nyDateFormatter.format(new Date(unixSec * 1000));
}

// ─── Classification ───────────────────────────────────────────────────────────

function classify(fullBoxPct: number, priceBoxPct: number): F4Box["state"] {
  if (fullBoxPct >= 0.85 && priceBoxPct < 0.45) return "3f_contraido";
  if (fullBoxPct >= 0.90) return "amplio";
  if (fullBoxPct >= 0.45) return "normal";
  if (fullBoxPct >= 0.30) return "contraido";
  return "estrecho";
}

// ─── Core computation ─────────────────────────────────────────────────────────

export function computeF4Boxes(candles: Candle[]): F4Box[] {
  if (candles.length < 201) return [];

  const sma20Map = new Map<number, number>(sma(candles, 20).map((p) => [p.time, p.value]));
  const sma200Map = new Map<number, number>(sma(candles, 200).map((p) => [p.time, p.value]));

  // Group candles by NY date
  const byDay = new Map<string, Candle[]>();
  for (const c of candles) {
    const d = getNYDateStr(c.time);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(c);
  }

  const days = [...byDay.keys()].sort();
  const boxes: F4Box[] = [];

  // Skip last day (today / partial)
  for (let di = 0; di < days.length - 1; di++) {
    const dayCandlesAll = byDay.get(days[di])!;

    // Last 30 min of RTH: 15:30 – 15:59 NY
    const window = dayCandlesAll.filter((c) => {
      const t = getNYTimeNum(c.time);
      return t >= 1530 && t < 1600;
    });

    if (window.length < 2) continue;

    let priceHigh = -Infinity;
    let priceLow = Infinity;
    let sma20High = -Infinity;
    let sma20Low = Infinity;
    let sma200Val: number | null = null;

    for (const c of window) {
      const bHigh = Math.max(c.open, c.close);
      const bLow = Math.min(c.open, c.close);
      priceHigh = Math.max(priceHigh, bHigh);
      priceLow = Math.min(priceLow, bLow);

      const s20 = sma20Map.get(c.time);
      if (s20 !== undefined) {
        sma20High = Math.max(sma20High, s20);
        sma20Low = Math.min(sma20Low, s20);
      }

      const s200 = sma200Map.get(c.time);
      if (s200 !== undefined) sma200Val = s200;
    }

    // Fallback: nearest SMA200 in the same day
    if (sma200Val === null) {
      for (const c of dayCandlesAll.slice().reverse()) {
        const v = sma200Map.get(c.time);
        if (v !== undefined) { sma200Val = v; break; }
      }
    }

    if (sma200Val === null || !isFinite(priceHigh) || !isFinite(priceLow)) continue;
    if (!isFinite(sma20High)) sma20High = priceHigh;
    if (!isFinite(sma20Low)) sma20Low = priceLow;

    // Price box = bodies + SMA20
    const pbTop = Math.max(priceHigh, sma20High);
    const pbBot = Math.min(priceLow, sma20Low);
    const pbMid = (pbTop + pbBot) / 2;
    const priceBoxPct = pbMid > 0 ? ((pbTop - pbBot) / pbMid) * 100 : 0;

    // Full box = price box + SMA200
    const fbTop = Math.max(pbTop, sma200Val);
    const fbBot = Math.min(pbBot, sma200Val);
    const fbMid = (fbTop + fbBot) / 2;
    const fullBoxPct = fbMid > 0 ? ((fbTop - fbBot) / fbMid) * 100 : 0;

    const state = classify(fullBoxPct, priceBoxPct);

    // 3F Contraído: rectangle shows only the price box (without SMA200)
    const rectTop = state === "3f_contraido" ? pbTop : fbTop;
    const rectBot = state === "3f_contraido" ? pbBot : fbBot;

    boxes.push({
      startTime: window[0].time,
      endTime: window[window.length - 1].time,
      top: rectTop,
      bottom: rectBot,
      state,
      date: days[di],
    });
  }

  return boxes;
}

// ─── React component ──────────────────────────────────────────────────────────

interface Props {
  candles: Candle[];
  chart: IChartApi | null;
  candleSeries: ISeriesApi<"Candlestick"> | null;
  enabled: boolean;
}

export function Fantastic4Overlay({ candles, chart, candleSeries, enabled }: Props) {
  // Re-render on pan/zoom so pixel coords stay in sync
  const [, setTick] = useState(0);
  const unsubRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!chart) return;
    const handler = () => setTick((t) => t + 1);
    const ts = chart.timeScale();
    ts.subscribeVisibleTimeRangeChange(handler);
    ts.subscribeVisibleLogicalRangeChange(handler);
    unsubRef.current = [
      () => ts.unsubscribeVisibleTimeRangeChange(handler),
      () => ts.unsubscribeVisibleLogicalRangeChange(handler),
    ];
    return () => unsubRef.current.forEach((fn) => fn());
  }, [chart]);

  if (!enabled || !chart || !candleSeries || candles.length === 0) return null;

  const boxes = computeF4Boxes(candles);
  if (boxes.length === 0) return null;

  const ts = chart.timeScale();

  const rects = boxes.flatMap((box, i) => {
    const x1 = ts.timeToCoordinate(box.startTime as UTCTimestamp);
    const x2 = ts.timeToCoordinate(box.endTime as UTCTimestamp);
    const y1 = candleSeries.priceToCoordinate(box.top);
    const y2 = candleSeries.priceToCoordinate(box.bottom);

    if (x1 === null || x2 === null || y1 === null || y2 === null) return [];

    const left = Math.min(x1, x2) - 4;
    const right = Math.max(x1, x2) + 4;
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    const width = Math.max(right - left, 6);
    const height = Math.max(bottom - top, 4);

    const { fill, border, label } = STATE_STYLES[box.state];

    return [
      <g key={`f4-${box.date}-${i}`}>
        <rect
          x={left}
          y={top}
          width={width}
          height={height}
          fill={fill}
          stroke={border}
          strokeWidth={1.5}
          rx={2}
        />
        <text
          x={left + 4}
          y={top - 5}
          fill={border}
          fontSize={10}
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight="700"
          style={{ userSelect: "none" }}
        >
          {label}
        </text>
      </g>,
    ];
  });

  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{ width: "100%", height: "100%", zIndex: 5 }}
    >
      {rects}
    </svg>
  );
}
