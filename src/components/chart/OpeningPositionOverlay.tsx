"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/binance/types";
import { computeF4Boxes } from "./Fantastic4Overlay";

// ─── Zone definitions ─────────────────────────────────────────────────────────
//
// All positions are relative to the 4F box of the PREVIOUS day.
// EB is also from the previous day's calculation.
//
// Zones (price ranges relative to 4F top/bottom):
//   TZ   (Trap Zone)  : [f4Bot, f4Top]               → red
//   +1                : [f4Top,       f4Top + 2×EB]   → green
//   -1                : [f4Bot - 2×EB, f4Bot]         → green
//   +2                : [f4Top + 2×EB, f4Top + 7×EB]  → blue
//   -2                : [f4Bot - 7×EB, f4Bot - 2×EB]  → blue
//   +3                : [f4Top + 7×EB, f4Top + 14×EB] → yellow
//   -3                : [f4Bot - 14×EB, f4Bot - 7×EB] → yellow
//   IPO+             : above f4Top + 14×EB             → gray (gap too large)
//   IPO-             : below f4Bot - 14×EB             → gray

const ZONE_STYLES = {
  tz:   { fill: "rgba(239,83,80,0.08)",    border: "rgba(239,83,80,0.35)",    label: "TZ" },
  p1:   { fill: "rgba(38,166,154,0.07)",   border: "rgba(38,166,154,0.30)",   label: "+1" },
  m1:   { fill: "rgba(38,166,154,0.07)",   border: "rgba(38,166,154,0.30)",   label: "-1" },
  p2:   { fill: "rgba(41,98,255,0.07)",    border: "rgba(41,98,255,0.30)",    label: "+2" },
  m2:   { fill: "rgba(41,98,255,0.07)",    border: "rgba(41,98,255,0.30)",    label: "-2" },
  p3:   { fill: "rgba(255,183,77,0.07)",   border: "rgba(255,183,77,0.30)",   label: "+3" },
  m3:   { fill: "rgba(255,183,77,0.07)",   border: "rgba(255,183,77,0.30)",   label: "-3" },
  ipo:  { fill: "rgba(150,150,150,0.05)",  border: "rgba(150,150,150,0.20)",  label: "IPO" },
} as const;

type ZoneKey = keyof typeof ZONE_STYLES;

interface ZoneRect {
  zoneKey: ZoneKey;
  priceTop: number;
  priceBot: number;
  timeStart: number; // unix seconds — 09:30 NY
  timeEnd: number;   // unix seconds — 10:10 NY
  date: string;
}

// ─── ET time helpers ──────────────────────────────────────────────────────────

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

// ─── EB recalculation (same logic as Fantastic4Overlay) ──────────────────────

function getMinEB(price: number): number {
  if (price < 50)  return 0.20;
  if (price < 100) return 0.30;
  if (price < 150) return 0.40;
  return 0.50;
}

/**
 * Calcula la EB usando la MEDIANA de los cuerpos del día anterior completo.
 * Misma lógica que calcEB en Fantastic4Overlay — ver comentario allí.
 */
function calcEBFromWindow(window4F: Candle[], allDayCandles: Candle[]): number {
  const candidates = allDayCandles.length > 0 ? allDayCandles : window4F;

  const bodies = candidates
    .map((c) => Math.abs(c.close - c.open))
    .sort((a, b) => a - b);
  const mid = Math.floor(bodies.length / 2);
  const medianBody =
    bodies.length % 2 === 1
      ? bodies[mid]
      : (bodies[mid - 1] + bodies[mid]) / 2;

  const refPrice = window4F[window4F.length - 1].close;
  return Math.max(getMinEB(refPrice), 2 * medianBody);
}

// ─── Core computation ─────────────────────────────────────────────────────────

export function computeOpeningZones(candles: Candle[]): ZoneRect[] {
  if (candles.length < 201) return [];

  // Get the F4 boxes (we need top/bottom per day)
  const f4Boxes = computeF4Boxes(candles);
  if (f4Boxes.length === 0) return [];

  // Build a map: date string → F4Box
  const f4ByDate = new Map(f4Boxes.map((b) => [b.date, b]));

  // Group candles by NY date
  const byDay = new Map<string, Candle[]>();
  for (const c of candles) {
    const d = getNYDateStr(c.time);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(c);
  }

  const days = [...byDay.keys()].sort();
  const zones: ZoneRect[] = [];

  // For each day (except the first, which has no previous day's F4)
  for (let di = 1; di < days.length; di++) {
    const today     = days[di];
    const yesterday = days[di - 1];

    const f4Box = f4ByDate.get(yesterday);
    if (!f4Box) continue;

    const todayCandles = byDay.get(today)!;

    // Opening window: 09:30 – 10:10 NY
    const openingCandles = todayCandles.filter((c) => {
      const t = getNYTimeNum(c.time);
      return t >= 930 && t < 1010;
    });

    if (openingCandles.length < 1) continue;

    const timeStart = openingCandles[0].time;
    const timeEnd   = openingCandles[openingCandles.length - 1].time;

    // Recalculate EB from previous day's 4F window
    const prevDayCandles = byDay.get(yesterday)!;
    const prev4FWindow = prevDayCandles.filter((c) => {
      const t = getNYTimeNum(c.time);
      return t >= 1530 && t < 1600;
    });
    if (prev4FWindow.length < 2) continue;

    const eb      = calcEBFromWindow(prev4FWindow, prevDayCandles);
    const f4Top   = f4Box.top;
    const f4Bot   = f4Box.bottom;

    // Build all 8 zone types
    const zoneList: Array<{ key: ZoneKey; top: number; bot: number }> = [
      { key: "tz",  top: f4Top,           bot: f4Bot },
      { key: "p1",  top: f4Top + 2 * eb,  bot: f4Top },
      { key: "m1",  top: f4Bot,           bot: f4Bot - 2 * eb },
      { key: "p2",  top: f4Top + 7 * eb,  bot: f4Top + 2 * eb },
      { key: "m2",  top: f4Bot - 2 * eb,  bot: f4Bot - 7 * eb },
      { key: "p3",  top: f4Top + 14 * eb, bot: f4Top + 7 * eb },
      { key: "m3",  top: f4Bot - 7 * eb,  bot: f4Bot - 14 * eb },
      // IPO: two bands beyond +3 / -3 (extend 10 more EBs arbitrarily)
      { key: "ipo", top: f4Top + 24 * eb, bot: f4Top + 14 * eb },
      { key: "ipo", top: f4Bot - 14 * eb, bot: f4Bot - 24 * eb },
    ];

    for (const z of zoneList) {
      zones.push({
        zoneKey:   z.key,
        priceTop:  z.top,
        priceBot:  z.bot,
        timeStart,
        timeEnd,
        date: today,
      });
    }
  }

  return zones;
}

// ─── React component ──────────────────────────────────────────────────────────

interface Props {
  candles: Candle[];
  chart: IChartApi | null;
  candleSeries: ISeriesApi<"Candlestick"> | null;
  enabled: boolean;
}

export function OpeningPositionOverlay({ candles, chart, candleSeries, enabled }: Props) {
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

  const zones = computeOpeningZones(candles);
  if (zones.length === 0) return null;

  const ts = chart.timeScale();

  const rects = zones.flatMap((zone, i) => {
    const x1 = ts.timeToCoordinate(zone.timeStart as UTCTimestamp);
    const x2 = ts.timeToCoordinate(zone.timeEnd as UTCTimestamp);
    const y1 = candleSeries.priceToCoordinate(zone.priceTop);
    const y2 = candleSeries.priceToCoordinate(zone.priceBot);

    if (x1 === null || x2 === null || y1 === null || y2 === null) return [];

    const left   = Math.min(x1, x2);
    const right  = Math.max(x1, x2);
    const top    = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    const width  = Math.max(right - left, 4);
    const height = Math.max(bottom - top, 2);

    const { fill, border, label } = ZONE_STYLES[zone.zoneKey];

    // Only show label on the first occurrence of this zone for this date
    const showLabel = i === 0 || zones[i - 1].date !== zone.date || zones[i - 1].zoneKey !== zone.zoneKey;

    return [
      <g key={`op-${zone.date}-${zone.zoneKey}-${i}`}>
        <rect
          x={left}
          y={top}
          width={width}
          height={height}
          fill={fill}
          stroke={border}
          strokeWidth={1}
          rx={1}
        />
        {showLabel && height > 10 && (
          <text
            x={left + 4}
            y={top + 11}
            fill={border}
            fontSize={9}
            fontFamily="Inter, system-ui, sans-serif"
            fontWeight="700"
            style={{ userSelect: "none" }}
          >
            {label}
          </text>
        )}
      </g>,
    ];
  });

  return (
    // zIndex 4 — behind candles (zIndex 5 is F4 overlay, chart canvas is above)
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{ width: "100%", height: "100%", zIndex: 4 }}
    >
      {rects}
    </svg>
  );
}
