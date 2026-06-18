"use client";

/**
 * RBIGBIOverlay.tsx
 * Renderiza los eventos RBI (Red Bar Ignored) y GBI (Green Bar Ignored)
 * como markers sobre el gráfico de velas.
 *
 * Se basa en el patrón VRI/VVI, pero filtrando para que la primera vela (barra de control)
 * sea clasificada como EB, EB+ o dual.
 *
 * Coloca este archivo en: src/components/chart/RBIGBIOverlay.tsx
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
import {
  calculateVRIVVI,
  alignMA,
  DEFAULT_VRIVVI_CONFIG,
  type VRIVVISignal,
} from "@/lib/indicators/vri-vvi";
import { computeCandleSizes } from "./CandleSizeOverlay";

interface Props {
  candles: Candle[];
  chart: IChartApi | null;
  candleSeries: ISeriesApi<"Candlestick"> | null;
  enabled: boolean;
  maFastPeriod?: number;
  maSlowPeriod?: number;
  trendFilter?: "NONE" | "SLOW_RISING" | "BOTH_RISING";
  minBodyPct?: number;
  minPositionPct?: number;
}

export function RBIGBIOverlay({
  candles,
  candleSeries,
  enabled,
  maFastPeriod   = 8,
  maSlowPeriod   = 20,
  trendFilter    = "BOTH_RISING",
  minBodyPct     = 30,
  minPositionPct = 30,
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

    if (!enabled || candles.length < 3) return;

    // ── 1. Calcular MAs alineadas ────────────────────────────────────────────
    const maFastValues = alignMA(candles, sma(candles, maFastPeriod).map((p) => p.value));
    const maSlowValues = alignMA(candles, sma(candles, maSlowPeriod).map((p) => p.value));

    // ── 2. Calcular señales VRI/VVI base ───────────────────────────────────
    const rawSignals: VRIVVISignal[] = calculateVRIVVI(candles, {
      ...DEFAULT_VRIVVI_CONFIG,
      maFastValues,
      maSlowValues,
      trendFilter,
      minBodyPct,
      minPositionPct,
    });

    // ── 3. Calcular clasificación de tamaños de velas ───────────────────────
    const sizedCandles = computeCandleSizes(candles);
    const sizeMap = new Map<number, string>();
    for (const item of sizedCandles) {
      sizeMap.set(item.candle.time, item.size);
    }

    // ── 4. Filtrar: Primera barra (s.controlBar) debe ser EB, EB+ o dual ───
    const filteredSignals = rawSignals.filter((s) => {
      const size = sizeMap.get(s.controlBar.time);
      return size === "eb" || size === "ebPlus" || size === "dual";
    });

    // ── 5. Construir markers ─────────────────────────────────────────────────
    const markers = filteredSignals
      .map((s) => ({
        time:     s.time as Time,
        // RBI es la equivalente a VRI (patrón alcista 🐂), GBI es equivalente a VVI (patrón bajista 🐻)
        position: s.type === "VRI" ? ("aboveBar" as const) : ("belowBar" as const),
        color:    s.type === "VRI" ? "#FF9100" : "#E040FB", // Naranja vibrante para RBI, Magenta/Violeta para GBI
        shape:    s.type === "VRI" ? ("arrowUp" as const) : ("arrowDown" as const),
        text:     s.type === "VRI" ? "RBI" : "GBI",
        size:     1.5,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));

    // ── 6. Crear plugin de markers (API lw-charts v5) ────────────────────────
    const plugin = createSeriesMarkers(candleSeries, markers);
    markersPluginRef.current = plugin;

    return () => {
      try {
        plugin.setMarkers([]);
      } catch {
        /* serie puede ya no existir */
      }
      markersPluginRef.current = null;
    };
  }, [candles, candleSeries, enabled, maFastPeriod, maSlowPeriod, trendFilter, minBodyPct, minPositionPct]);

  return null;
}
