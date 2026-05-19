"use client";

/**
 * VRIVVIOverlay.tsx
 * Renderiza las señales VRI/VVI como markers sobre el gráfico de velas.
 * Compatible con lightweight-charts v5 (usa createSeriesMarkers).
 *
 * Coloca este archivo en: src/components/chart/VRIVVIOverlay.tsx
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

export function VRIVVIOverlay({
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
      try { markersPluginRef.current.setMarkers([]); } catch { /* ignorar */ }
      markersPluginRef.current = null;
    }

    if (!enabled || candles.length < 3) return;

    // ── Calcular MAs alineadas ────────────────────────────────────────────
    const maFastValues = alignMA(candles, sma(candles, maFastPeriod).map((p) => p.value));
    const maSlowValues = alignMA(candles, sma(candles, maSlowPeriod).map((p) => p.value));

    // ── Calcular señales ──────────────────────────────────────────────────
    const signals: VRIVVISignal[] = calculateVRIVVI(candles, {
      ...DEFAULT_VRIVVI_CONFIG,
      maFastValues,
      maSlowValues,
      trendFilter,
      minBodyPct,
      minPositionPct,
    });

    // ── Construir markers ─────────────────────────────────────────────────
    const markers = signals
      .map((s) => ({
        time:     s.time as Time,
        position: s.type === "VRI" ? ("aboveBar" as const) : ("belowBar" as const),
        color:    s.type === "VRI" ? "#00C853" : "#FF1744",
        shape:    s.type === "VRI" ? ("arrowUp" as const) : ("arrowDown" as const),
        text:     s.type === "VRI" ? "VRI" : "VVI",
        size:     1.5,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));

    // ── Crear plugin de markers (API lw-charts v5) ────────────────────────
    const plugin = createSeriesMarkers(candleSeries, markers);
    markersPluginRef.current = plugin;

    return () => {
      try { plugin.setMarkers([]); } catch { /* serie puede ya no existir */ }
      markersPluginRef.current = null;
    };
  }, [candles, candleSeries, enabled, maFastPeriod, maSlowPeriod, trendFilter, minBodyPct, minPositionPct]);

  return null;
}

export function findSignalAt(
  signals: VRIVVISignal[],
  time: number,
  toleranceSeconds = 60,
): VRIVVISignal | undefined {
  return signals.find((s) => Math.abs(s.time - time) <= toleranceSeconds);
}
