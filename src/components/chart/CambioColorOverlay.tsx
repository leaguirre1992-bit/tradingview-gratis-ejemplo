"use client";

/**
 * CambioColorOverlay.tsx
 * Renderiza los eventos "Cambio de color" (CC Verde y CC Rojo)
 * como markers sobre el gráfico de velas.
 *
 * Coloca este archivo en: src/components/chart/CambioColorOverlay.tsx
 */

import { useEffect, useRef } from "react";
import {
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
} from "lightweight-charts";
import type { Candle } from "@/lib/binance/types";
import { sma } from "@/lib/indicators";
import { alignMA } from "@/lib/indicators/vri-vvi";
import { computeCandleSizes } from "./CandleSizeOverlay";

interface Props {
  candles: Candle[];
  chart: IChartApi | null;
  candleSeries: ISeriesApi<"Candlestick"> | null;
  enabled: boolean;
  maFastPeriod?: number;
  maSlowPeriod?: number;
}

interface CCSignal {
  time: number;
  type: "CC_VERDE" | "CC_ROJO";
}

function maDir(values: number[], idx: number): number {
  if (idx < 1 || idx >= values.length) return 0;
  if (values[idx] > values[idx - 1]) return 1;
  if (values[idx] < values[idx - 1]) return -1;
  return 0;
}

export function CambioColorOverlay({
  candles,
  candleSeries,
  enabled,
  maFastPeriod = 8,
  maSlowPeriod = 20,
}: Props) {
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  useEffect(() => {
    if (!candleSeries) return;

    // Limpiar plugin anterior
    if (markersPluginRef.current) {
      try {
        markersPluginRef.current.setMarkers([]);
      } catch {
        /* ignorar */
      }
      markersPluginRef.current = null;
    }

    if (!enabled || candles.length < 2) return;

    // ── 1. Calcular MAs alineadas ────────────────────────────────────────────
    const maFastValues = alignMA(candles, sma(candles, maFastPeriod).map((p) => p.value));
    const maSlowValues = alignMA(candles, sma(candles, maSlowPeriod).map((p) => p.value));

    // ── 2. Calcular clasificación de tamaños de velas ───────────────────────
    const sizedCandles = computeCandleSizes(candles);
    const sizeMap = new Map<number, string>();
    for (const item of sizedCandles) {
      sizeMap.set(item.candle.time, item.size);
    }

    const signals: CCSignal[] = [];

    // ── 3. Analizar el patrón bar-by-bar ─────────────────────────────────────
    for (let i = 1; i < candles.length; i++) {
      const c1 = candles[i - 1]; // primera barra (ignorada)
      const c2 = candles[i];     // segunda barra (señal / control)

      const isGreen1 = c1.close > c1.open;
      const isRed1   = c1.open > c1.close;
      const isGreen2 = c2.close > c2.open;
      const isRed2   = c2.open > c2.close;

      const isCCVerde = isRed1 && isGreen2;   // Roja -> Verde
      const isCCRojo   = isGreen1 && isRed2;   // Verde -> Roja

      if (!isCCVerde && !isCCRojo) continue;

      // ── REGLA 2: Tamaño de vela ignorada (c1) debe ser Pequeño o Normal ───
      const size1 = sizeMap.get(c1.time);
      const isSizeOk = size1 === "pequeña" || size1 === "normal";
      if (!isSizeOk) continue;

      // ── REGLA 3: Ruptura por al menos 1 centavo (0.01) ────────────────────
      if (isCCVerde) {
        if (c2.high < c1.high + 0.01) continue;
      } else {
        if (c2.low > c1.low - 0.01) continue;
      }

      // ── REGLA 4: Filtro de Tendencia (MAs 8 y 20) ────────────────────────
      const hasMAs = maFastValues.length > i && maSlowValues.length > i;
      if (hasMAs) {
        const dirFast = maDir(maFastValues, i);
        const dirSlow = maDir(maSlowValues, i);

        if (isCCVerde) {
          // Ambas subiendo
          if (dirFast <= 0 || dirSlow <= 0) continue;
        } else {
          // Ambas bajando
          if (dirFast >= 0 || dirSlow >= 0) continue;
        }
      }

      // ── REGLA 5: Cuerpo mínimo de la barra de señal (c2) >= 30% ───────────
      const range2 = c2.high - c2.low;
      if (range2 === 0) continue;
      const body2 = Math.abs(c2.close - c2.open);
      const bodyPct2 = (body2 / range2) * 100;
      if (bodyPct2 < 30) continue;

      signals.push({
        time: c2.time,
        type: isCCVerde ? "CC_VERDE" : "CC_ROJO",
      });
    }

    // ── 4. Construir markers para lightweight-charts ─────────────────────────
    const markers = signals
      .map((s) => ({
        time:     s.time as Time,
        position: s.type === "CC_VERDE" ? ("aboveBar" as const) : ("belowBar" as const),
        color:    s.type === "CC_VERDE" ? "#00E676" : "#FF1744", // Verde esmeralda para CC V, Rojo brillante para CC R
        shape:    s.type === "CC_VERDE" ? ("arrowUp" as const) : ("arrowDown" as const),
        text:     s.type === "CC_VERDE" ? "CC V" : "CC R",
        size:     1.5,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));

    // ── 5. Crear plugin de markers (API lw-charts v5) ────────────────────────
    const plugin = createSeriesMarkers(candleSeries, markers);
    markersPluginRef.current = plugin;

    return () => {
      try {
        plugin.setMarkers([]);
      } catch {
        /* ignorar */
      }
      markersPluginRef.current = null;
    };
  }, [candles, candleSeries, enabled, maFastPeriod, maSlowPeriod]);

  return null;
}
