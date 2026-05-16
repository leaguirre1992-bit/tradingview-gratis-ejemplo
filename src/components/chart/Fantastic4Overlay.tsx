"use client";

import { useMemo } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/binance/types";
import { sma } from "@/lib/indicators";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface F4Box {
  /** Unix timestamp of the first candle in the 30-min window */
  startTime: number;
  /** Unix timestamp of the last candle in the 30-min window */
  endTime: number;
  /** Top price of the rectangle (highest body close/open in window, incl. SMA200 if not 3F) */
  top: number;
  /** Bottom price of the rectangle (lowest body close/open in window, incl. SMA200 if not 3F) */
  bottom: number;
  /** Classification */
  state: "estrecho" | "contraido" | "normal" | "amplio" | "3f_contraido";
  /** Day label for debugging */
  date: string;
}

// ─── Color map ───────────────────────────────────────────────────────────────

const STATE_COLORS: Record<F4Box["state"], { fill: string; border: string; label: string }> = {
  estrecho:     { fill: "rgba(144,238,144,0.18)", border: "#90ee90", label: "Estrecho" },
  contraido:    { fill: "rgba(38,166,154,0.18)",  border: "#26a69a", label: "Contraído" },
  normal:       { fill: "rgba(255,183,77,0.18)",  border: "#ffb74d", label: "Normal" },
  amplio:       { fill: "rgba(239,83,80,0.18)",   border: "#ef5350", label: "Amplio" },
  "3f_contraido": { fill: "rgba(171,71,188,0.18)", border: "#ab47bc", label: "3F Contraídos" },
};

// ─── Classification thresholds ───────────────────────────────────────────────
// Based on % range relative to mid-price.
// Thresholds from the other AI's analysis + your visual descriptions:
//   estrecho    < 0.30 %
//   contraido   0.30 – 0.45 %
//   normal      0.45 – 0.90 %
//   amplio      ≥ 0.90 %
//   3f_contraido: fullBox ≥ 0.85 % BUT priceBox (no SMA200) < 0.45 %

function classifyBox(
  fullBoxPct: number,   // (top-bottom)/mid * 100, using SMA200
  priceBoxPct: number,  // same but excluding SMA200
): F4Box["state"] {
  // 3F Contraído: SMA200 far away, but price+SMA20 very tight
  if (fullBoxPct >= 0.85 && priceBoxPct < 0.45) return "3f_contraido";
  if (fullBoxPct >= 0.90) return "amplio";
  if (fullBoxPct >= 0.45) return "normal";
  if (fullBoxPct >= 0.30) return "contraido";
  return "estrecho";
}

// ─── Core calculation ─────────────────────────────────────────────────────────

/**
 * NYSE / NASDAQ regular session ends at 16:00 ET.
 * "Last 30 minutes" = 15:30–16:00 ET.
 * We detect day boundaries via ET time.
 */
function toET(unixSec: number): Date {
  return new Date(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).format(new Date(unixSec * 1000))
      .replace(/(\d+)\/(\d+)\/(\d+),\s/, "$3-$1-$2T")
      .replace(" ", "T") + "Z"
  );
}

function getETDateStr(unixSec: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(unixSec * 1000));
}

function getETHourMin(unixSec: number): { h: number; m: number } {
  const d = toET(unixSec);
  return { h: d.getHours(), m: d.getMinutes() };
}

export function computeF4Boxes(candles: Candle[]): F4Box[] {
  if (candles.length < 200) return [];

  // Compute SMA20 and SMA200 for all candles
  const sma20Data = sma(candles, 20);
  const sma200Data = sma(candles, 200);

  const sma20Map = new Map<number, number>(sma20Data.map((p) => [p.time, p.value]));
  const sma200Map = new Map<number, number>(sma200Data.map((p) => [p.time, p.value]));

  // Group candles by ET date
  const byDay = new Map<string, Candle[]>();
  for (const c of candles) {
    const d = getETDateStr(c.time);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(c);
  }

  // Sort days chronologically
  const days = [...byDay.keys()].sort();
  
  // We compute for all days except the current one (last day = "today")
  // So we draw the box starting from day index 0 up to days.length - 2
  const boxes: F4Box[] = [];

  for (let di = 0; di < days.length - 1; di++) {
    const day = days[di];
    const dayCandlesAll = byDay.get(day)!;

    // Filter to last-30-min window: 15:30 to 16:00 ET
    const window = dayCandlesAll.filter((c) => {
      const { h, m } = getETHourMin(c.time);
      const totalMin = h * 60 + m;
      return totalMin >= 15 * 60 + 30 && totalMin < 16 * 60;
    });

    if (window.length < 3) continue; // not enough data for this day

    // Price box: highest and lowest BODY (close/open), no wicks
    let priceHigh = -Infinity;
    let priceLow = Infinity;
    let sma20High = -Infinity;
    let sma20Low = Infinity;
    let sma200Val: number | null = null;

    for (const c of window) {
      const bodyHigh = Math.max(c.open, c.close);
      const bodyLow = Math.min(c.open, c.close);
      if (bodyHigh > priceHigh) priceHigh = bodyHigh;
      if (bodyLow < priceLow) priceLow = bodyLow;

      const s20 = sma20Map.get(c.time);
      if (s20 !== undefined) {
        if (s20 > sma20High) sma20High = s20;
        if (s20 < sma20Low) sma20Low = s20;
      }

      // Use the SMA200 at the last candle of the window
      const s200 = sma200Map.get(c.time);
      if (s200 !== undefined) sma200Val = s200;
    }

    // Fallback: use the SMA200 at the closest candle to the window
    if (sma200Val === null) {
      for (const c of [...window].reverse()) {
        const v = sma200Map.get(c.time);
        if (v !== undefined) { sma200Val = v; break; }
      }
    }
    if (sma200Val === null) continue;

    // Price box (SMA20 + price bodies)
    const priceBoxTop = Math.max(priceHigh, sma20High);
    const priceBoxBottom = Math.min(priceLow, sma20Low < Infinity ? sma20Low : priceLow);
    const priceBoxMid = (priceBoxTop + priceBoxBottom) / 2;
    const priceBoxPct = priceBoxMid > 0
      ? ((priceBoxTop - priceBoxBottom) / priceBoxMid) * 100
      : 0;

    // Full box (adds SMA200)
    const fullBoxTop = Math.max(priceBoxTop, sma200Val);
    const fullBoxBottom = Math.min(priceBoxBottom, sma200Val);
    const fullBoxMid = (fullBoxTop + fullBoxBottom) / 2;
    const fullBoxPct = fullBoxMid > 0
      ? ((fullBoxTop - fullBoxBottom) / fullBoxMid) * 100
      : 0;

    const state = classifyBox(fullBoxPct, priceBoxPct);

    // For 3F Contraído: the visible rectangle uses priceBox (not the full one with SMA200)
    const rectTop = state === "3f_contraido" ? priceBoxTop : fullBoxTop;
    const rectBottom = state === "3f_contraido" ? priceBoxBottom : fullBoxBottom;

    boxes.push({
      startTime: window[0].time,
      endTime: window[window.length - 1].time,
      top: rectTop,
      bottom: rectBottom,
      state,
      date: day,
    });
  }

  return boxes;
}

// ─── React component ──────────────────────────────────────────────────────────

interface Props {
  candles: Candle[];
  chart: IChartApi | null;
  candleSeries: ISeriesApi<"Candlestick"> | null;
  /** Whether the overlay is enabled */
  enabled: boolean;
}

export function Fantastic4Overlay({ candles, chart, candleSeries, enabled }: Props) {
  const boxes = useMemo(() => {
    if (!enabled || candles.length === 0) return [];
    return computeF4Boxes(candles);
  }, [candles, enabled]);

  if (!enabled || !chart || !candleSeries || boxes.length === 0) return null;

  const ts = chart.timeScale();

  const rects = boxes.map((box, i) => {
    // Convert price/time → pixel coords
    const x1 = ts.timeToCoordinate(box.startTime as UTCTimestamp);
    // Add 1 bar width to x2 so the rect covers the last candle
    const x2 = ts.timeToCoordinate(box.endTime as UTCTimestamp);
    const y1 = candleSeries.priceToCoordinate(box.top);
    const y2 = candleSeries.priceToCoordinate(box.bottom);

    if (x1 === null || x2 === null || y1 === null || y2 === null) return null;

    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    const width = Math.max(right - left, 4);
    const height = Math.max(bottom - top, 4);

    const { fill, border, label } = STATE_COLORS[box.state];

    return (
      <g key={`${box.date}-${i}`}>
        {/* Main rectangle */}
        <rect
          x={left}
          y={top}
          width={width}
          height={height}
          fill={fill}
          stroke={border}
          strokeWidth={1.5}
          strokeDasharray="4 2"
          rx={2}
        />
        {/* Label at top-left of rect */}
        <text
          x={left + 5}
          y={top - 4}
          fill={border}
          fontSize={10}
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight="600"
        >
          {label}
        </text>
      </g>
    );
  });

  // The SVG must cover the full chart container — use absolute positioning
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ zIndex: 5 }}
    >
      {rects}
    </svg>
  );
}
