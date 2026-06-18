"use client";

/**
 * VelaElefanteEventosOverlay.tsx
 * Renderiza los eventos específicos por tamaño de la Vela Elefante (VE_X)
 * como markers nativos sobre el gráfico de velas.
 *
 * Coloca este archivo en: src/components/chart/VelaElefanteEventosOverlay.tsx
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
import { sma, atr } from "@/lib/indicators";
import { alignMA } from "@/lib/indicators/vri-vvi";
import { computeCandleSizes } from "./CandleSizeOverlay";

interface Props {
  candles: Candle[];
  chart: IChartApi | null;
  candleSeries: ISeriesApi<"Candlestick"> | null;
  ebConfirmadaEnabled: boolean;
  ebPlusEnabled: boolean;
  ebDualEnabled: boolean;
  ebViolentaEnabled: boolean;
  pdcm?: number;          // Porcentaje de cuerpo mínimo % (default: 70)
  cdba?: number;          // Cantidad de barras anteriores para ATR (default: 100)
  fdb?: number;           // Factor de búsqueda de ATR (default: 1.3)
  maFastPeriod?: number;  // Período de media rápida para tendencia (default: 8)
}

function maDir(values: number[], idx: number): number {
  if (idx < 1 || idx >= values.length) return 0;
  if (values[idx] > values[idx - 1]) return 1;
  if (values[idx] < values[idx - 1]) return -1;
  return 0;
}

export function VelaElefanteEventosOverlay({
  candles,
  candleSeries,
  ebConfirmadaEnabled,
  ebPlusEnabled,
  ebDualEnabled,
  ebViolentaEnabled,
  pdcm = 70,
  cdba = 100,
  fdb = 1.3,
  maFastPeriod = 8,
}: Props) {
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  useEffect(() => {
    if (!candleSeries) return;

    // Limpiar marcadores anteriores
    if (markersPluginRef.current) {
      try {
        markersPluginRef.current.setMarkers([]);
      } catch {
        /* ignorar */
      }
      markersPluginRef.current = null;
    }

    const anyEnabled =
      ebConfirmadaEnabled || ebPlusEnabled || ebDualEnabled || ebViolentaEnabled;

    if (!anyEnabled || candles.length < cdba + 1) return;

    // ── 1. Calcular ATR y MAs alineadas ─────────────────────────────────────
    const atrPoints = atr(candles, cdba);
    const atrValues = alignMA(candles, atrPoints.map((p) => p.value));
    const maFastValues = alignMA(candles, sma(candles, maFastPeriod).map((p) => p.value));

    // ── 2. Calcular clasificación de tamaños de todas las velas ─────────────
    const sizedCandles = computeCandleSizes(candles);
    const sizeMap = new Map<number, string>();
    for (const item of sizedCandles) {
      sizeMap.set(item.candle.time, item.size);
    }

    const markersList = [];

    // ── 3. Evaluar reglas bar-by-bar a partir del periodo de ATR ──────────────
    for (let i = cdba; i < candles.length; i++) {
      const c = candles[i];
      const prevAtr = atrValues[i - 1]; // atr[1] en el script

      if (isNaN(prevAtr) || prevAtr === 0) continue;

      const isGreen = c.close > c.open;
      const isRed   = c.open > c.close;
      if (!isGreen && !isRed) continue;

      // ── REGLA 1: Porcentaje de cuerpo mínimo (por defecto >= 70%) ───────────
      const range = c.high - c.low;
      if (range === 0) continue;
      const body = Math.abs(c.close - c.open);
      const bodyPct = (body / range) * 100;
      if (bodyPct < pdcm) continue;

      // ── REGLA 2: Cuerpo mayor o igual al ATR previo por el factor ──────────
      if (body < prevAtr * fdb) continue;

      // ── REGLA 3: Filtro de Tendencia (Dirección de la Media Rápida) ────────
      const dirFast = maDir(maFastValues, i);
      if (isGreen) {
        if (dirFast <= 0) continue;
      } else {
        if (dirFast >= 0) continue;
      }

      // ¡Es una Vela Elefante (VE_X)!
      // Ahora, filtramos según su tamaño exacto y si el indicador correspondiente está activo.
      const size = sizeMap.get(c.time);
      let eventColor = "";
      let eventText = "";
      let isMatched = false;

      if (size === "eb" && ebConfirmadaEnabled) {
        eventColor = "#ffb74d"; // Naranja
        eventText = "EB";
        isMatched = true;
      } else if (size === "ebPlus" && ebPlusEnabled) {
        eventColor = "#ff7043"; // Naranja-rojo
        eventText = "EB+";
        isMatched = true;
      } else if (size === "dual" && ebDualEnabled) {
        eventColor = "#ef5350"; // Rojo
        eventText = "EBD";
        isMatched = true;
      } else if (size === "violencia" && ebViolentaEnabled) {
        eventColor = "#ab47bc"; // Violeta
        eventText = "EBV";
        isMatched = true;
      }

      if (!isMatched) continue;

      markersList.push({
        time:     c.time as Time,
        position: isGreen ? ("aboveBar" as const) : ("belowBar" as const),
        color:    eventColor,
        shape:    isGreen ? ("arrowUp" as const) : ("arrowDown" as const),
        text:     eventText,
        size:     1.5,
      });
    }

    // Ordenar cronológicamente
    markersList.sort((a, b) => (a.time as number) - (b.time as number));

    // ── 4. Crear markers en la serie ──────────────────────────────────────────
    const plugin = createSeriesMarkers(candleSeries, markersList);
    markersPluginRef.current = plugin;

    return () => {
      try {
        plugin.setMarkers([]);
      } catch {
        /* ignorar */
      }
      markersPluginRef.current = null;
    };
  }, [
    candles,
    candleSeries,
    ebConfirmadaEnabled,
    ebPlusEnabled,
    ebDualEnabled,
    ebViolentaEnabled,
    pdcm,
    cdba,
    fdb,
    maFastPeriod,
  ]);

  return null;
}
