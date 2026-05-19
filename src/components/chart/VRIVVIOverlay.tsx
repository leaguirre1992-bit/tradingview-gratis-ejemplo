"use client";

/**
 * VRIVVIOverlay.tsx
 * Renderiza las señales VRI/VVI como markers sobre el gráfico de velas.
 *
 * Coloca este archivo en: src/components/chart/VRIVVIOverlay.tsx
 *
 * Sigue exactamente el mismo patrón que Fantastic4Overlay y OpeningPositionOverlay
 * que ya existen en el proyecto.
 */

import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
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
  /** Período de la MA rápida (default 8 — igual que SMA8 del visor) */
  maFastPeriod?: number;
  /** Período de la MA lenta (default 20 — igual que SMA20 del visor) */
  maSlowPeriod?: number;
  /** Filtro de tendencia: "NONE" | "SLOW_RISING" | "BOTH_RISING" */
  trendFilter?: "NONE" | "SLOW_RISING" | "BOTH_RISING";
  /** % mínimo del cuerpo de la barra de control (default 30) */
  minBodyPct?: number;
  /** % mínimo de posición de la barra ignorada (default 30) */
  minPositionPct?: number;
}

export function VRIVVIOverlay({
  candles,
  chart,
  candleSeries,
  enabled,
  maFastPeriod  = 8,
  maSlowPeriod  = 20,
  trendFilter   = "BOTH_RISING",
  minBodyPct    = 30,
  minPositionPct = 30,
}: Props) {
  // Guardamos la referencia a los markers para poder limpiarlos
  const markersApplied = useRef(false);

  useEffect(() => {
    if (!candleSeries) return;

    if (!enabled || candles.length < 3) {
      // Limpiar markers si se deshabilita el indicador
      if (markersApplied.current) {
        candleSeries.setMarkers([]);
        markersApplied.current = false;
      }
      return;
    }

    // ── Calcular MAs alineadas con el array de velas ──────────────────────
    const sma8pts  = sma(candles, maFastPeriod);
    const sma20pts = sma(candles, maSlowPeriod);

    const maFastValues = alignMA(candles, sma8pts.map((p) => p.value));
    const maSlowValues = alignMA(candles, sma20pts.map((p) => p.value));

    // ── Calcular señales ──────────────────────────────────────────────────
    const signals: VRIVVISignal[] = calculateVRIVVI(candles, {
      ...DEFAULT_VRIVVI_CONFIG,
      maFastValues,
      maSlowValues,
      trendFilter,
      minBodyPct,
      minPositionPct,
    });

    // ── Convertir señales a markers de lightweight-charts ─────────────────
    // setMarkers reemplaza todos los markers del candleSeries, así que
    // incluimos sólo los de VRI/VVI (no mezclamos con otros indicadores
    // que usen markers en la misma serie).
    const markers = signals.map((s) => ({
      time:     s.time as number,
      position: s.type === "VRI" ? ("aboveBar" as const) : ("belowBar" as const),
      color:    s.type === "VRI" ? "#00C853" : "#FF1744",
      shape:    s.type === "VRI" ? ("arrowUp" as const)  : ("arrowDown" as const),
      text:     s.type === "VRI" ? "🐂 VRI"  : "🐻 VVI",
      size:     1.5,
    }));

    // lightweight-charts requiere markers ordenados por tiempo
    markers.sort((a, b) => (a.time as number) - (b.time as number));

    candleSeries.setMarkers(markers);
    markersApplied.current = markers.length > 0;

    // Cleanup: limpiar markers cuando el componente se desmonta o cambia enabled
    return () => {
      try {
        candleSeries.setMarkers([]);
        markersApplied.current = false;
      } catch {
        // serie puede haberse eliminado ya
      }
    };
  }, [
    candles,
    candleSeries,
    enabled,
    maFastPeriod,
    maSlowPeriod,
    trendFilter,
    minBodyPct,
    minPositionPct,
  ]);

  // Este componente no renderiza DOM propio — sólo llama a la API del chart
  return null;
}

// ─── Hook auxiliar para el tooltip de señales ────────────────────────────────
// Exportamos también una función que, dado un timestamp, busca si hay una
// señal VRI/VVI cercana (útil para mostrar niveles SL/TP en un futuro tooltip).
export function findSignalAt(
  signals: VRIVVISignal[],
  time: number,
  toleranceSeconds = 60,
): VRIVVISignal | undefined {
  return signals.find((s) => Math.abs(s.time - time) <= toleranceSeconds);
}
