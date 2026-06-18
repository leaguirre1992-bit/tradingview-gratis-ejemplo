"use client";

/**
 * CandleSizeOverlay.tsx
 * Clasifica cada vela según su tamaño de cuerpo relativo a la EB del día,
 * y plotea un punto de color sobre/bajo la vela según su categoría.
 *
 * Categorías (múltiplos de la mediana del día):
 *   pequeña  : rango < 1.0 × normal
 *   normal   : 1.0 × normal ≤ rango < 2.0 × normal
 *   eb       : 2.0 × normal ≤ rango < 3.0 × normal
 *   ebPlus   : 3.0 × normal ≤ rango < 4.0 × normal
 *   dual     : 4.0 × normal ≤ rango < 6.0 × normal
 *   violencia: rango ≥ 6.0 × normal
 *
 * El punto aparece ENCIMA de la vela (alcista) o DEBAJO (bajista).
 *
 * Coloca este archivo en: src/components/chart/CandleSizeOverlay.tsx
 */

import { useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/binance/types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CandleSize = "pequeña" | "normal" | "eb" | "ebPlus" | "dual" | "violencia";

export interface CandleSizeConfig {
  pequeña:   boolean;
  normal:    boolean;
  eb:        boolean;
  ebPlus:    boolean;
  dual:      boolean;
  violencia: boolean;
}

export const DEFAULT_CANDLE_SIZE_CONFIG: CandleSizeConfig = {
  pequeña:   false,
  normal:    false,
  eb:        true,
  ebPlus:    true,
  dual:      true,
  violencia: true,
};

// ─── Colores por categoría ────────────────────────────────────────────────────

export const CANDLE_SIZE_COLORS: Record<CandleSize, string> = {
  pequeña:   "#78909c", // gris azulado
  normal:    "#b0bec5", // gris claro
  eb:        "#ffb74d", // naranja
  ebPlus:    "#ff7043", // naranja-rojo
  dual:      "#ef5350", // rojo
  violencia: "#ab47bc", // violeta
};

// ─── Helpers NY time ──────────────────────────────────────────────────────────

const nyDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getNYDateStr(unixSec: number): string {
  return nyDateFormatter.format(new Date(unixSec * 1000));
}

// ─── Helpers EB ───────────────────────────────────────────────────────────────

function getMinEB(price: number): number {
  if (price < 50)  return 0.20;
  if (price < 100) return 0.30;
  if (price < 150) return 0.40;
  if (price < 200) return 0.50;
  if (price < 250) return 0.50;
  if (price < 300) return 0.50;
  return 0.50;
}

function getMaxEB(price: number): number {
  if (price < 50)  return 0.30;
  if (price < 100) return 0.50;
  if (price < 150) return 0.60;
  if (price < 200) return 0.80;
  if (price < 250) return 0.80;
  if (price < 300) return 0.80;
  return 0.80;
}

/**
 * Mediana de los cuerpos del día — robusta a outliers (EB, Dual, Violencia).
 * Retorna la barra "normal" del día.
 */
function calcMedianBody(dayCandlesAll: Candle[]): number {
  if (dayCandlesAll.length === 0) return 0;
  const bodies = dayCandlesAll
    .map((c) => c.high - c.low)
    .sort((a, b) => a - b);
  const mid = Math.floor(bodies.length / 2);
  return bodies.length % 2 === 1
    ? bodies[mid]
    : (bodies[mid - 1] + bodies[mid]) / 2;
}

// ─── Clasificación ────────────────────────────────────────────────────────────

/**
 * Clasifica una vela según su cuerpo en relación a la barra normal del día.
 * La EB mínima actúa como piso y la EB máxima como techo para el tamaño normal.
 */
function classifyCandle(
  candle: Candle,
  normalBody: number,
  refPrice: number,
): CandleSize {
  const range = candle.high - candle.low; // rango completo (high - low)
  const minEB = getMinEB(refPrice);

  // La barra normal es la mediana, acotada entre minEB/2 (piso) y maxEB/2 (techo)
  const minNormal = minEB / 2;
  const maxNormal = getMaxEB(refPrice) / 2;
  const normal = Math.min(maxNormal, Math.max(minNormal, normalBody));

  if (range >= normal * 6.0) return "violencia";
  if (range >= normal * 4.0) return "dual";
  if (range >= normal * 3.0) return "ebPlus";
  if (range >= normal * 2.0) return "eb";
  if (range >= normal * 1.0) return "normal";
  return "pequeña";
}

// ─── Cálculo principal ────────────────────────────────────────────────────────

export interface SizedCandle {
  candle: Candle;
  size: CandleSize;
}

export function computeCandleSizes(candles: Candle[]): SizedCandle[] {
  if (candles.length === 0) return [];

  // Agrupar por día NY
  const byDay = new Map<string, Candle[]>();
  for (const c of candles) {
    const d = getNYDateStr(c.time);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(c);
  }

  const result: SizedCandle[] = [];

  for (const [, dayCandlesAll] of byDay) {
    const normalBody = calcMedianBody(dayCandlesAll);
    const refPrice   = dayCandlesAll[dayCandlesAll.length - 1].close;

    for (const c of dayCandlesAll) {
      result.push({
        candle: c,
        size:   classifyCandle(c, normalBody, refPrice),
      });
    }
  }

  // Ordenar por tiempo (los días se procesan en orden de Map, pero por si acaso)
  result.sort((a, b) => a.candle.time - b.candle.time);
  return result;
}

// ─── Componente React ─────────────────────────────────────────────────────────

interface Props {
  candles: Candle[];
  chart: IChartApi | null;
  candleSeries: ISeriesApi<"Candlestick"> | null;
  enabled: boolean;
  /** Qué tamaños plotear (cada uno puede activarse/desactivarse) */
  config?: Partial<CandleSizeConfig>;
}

const DOT_RADIUS = 3;
const DOT_OFFSET = 6; // px de separación entre el wick y el punto

export function CandleSizeOverlay({
  candles,
  chart,
  candleSeries,
  enabled,
  config = {},
}: Props) {
  const [, setTick] = useState(0);
  const unsubRef = useRef<Array<() => void>>([]);

  // Re-render al hacer zoom / scroll (igual que F4 y OpeningPosition)
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

  const cfg: CandleSizeConfig = { ...DEFAULT_CANDLE_SIZE_CONFIG, ...config };
  const sized = computeCandleSizes(candles);
  const ts    = chart.timeScale();

  const dots = sized.flatMap((sc, i) => {
    if (!cfg[sc.size]) return [];

    const x = ts.timeToCoordinate(sc.candle.time as UTCTimestamp);
    // Para el punto usamos high (encima de vela alcista) o low (debajo de bajista)
    const isUp    = sc.candle.close >= sc.candle.open;
    const refPrice = isUp ? sc.candle.high : sc.candle.low;
    const y = candleSeries.priceToCoordinate(refPrice);

    if (x === null || y === null) return [];

    const cy = isUp ? y - DOT_OFFSET : y + DOT_OFFSET;
    const color = CANDLE_SIZE_COLORS[sc.size];

    return [
      <circle
        key={`cs-${sc.candle.time}-${i}`}
        cx={x}
        cy={cy}
        r={DOT_RADIUS}
        fill={color}
        opacity={0.85}
      />,
    ];
  });

  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{ width: "100%", height: "100%", zIndex: 6 }}
    >
      {dots}
    </svg>
  );
}
