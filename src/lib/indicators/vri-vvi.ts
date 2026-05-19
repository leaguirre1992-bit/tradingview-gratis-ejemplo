/**
 * vri-vvi.ts
 * Indicador "Velas Rojas y Verdes Ignoradas" de Oliver Velez
 * Traducido de Pine Script v4 a TypeScript para lightweight-charts
 *
 * Coloca este archivo en: src/lib/indicators/vri-vvi.ts
 */

import type { Candle } from "@/lib/binance/types";

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export interface VRIVVISignal {
  /** Timestamp unix (segundos) de la barra señal — misma escala que Candle.time */
  time: number;
  /** VRI = patrón alcista 🐂  |  VVI = patrón bajista 🐻 */
  type: "VRI" | "VVI";
  /** Índice dentro del array de velas de la barra señal */
  barIndex: number;

  // Niveles de gestión de la operación (calculados sobre la barra ignorada)
  stopLoss: number;
  breakEven: number;
  tp1: number;
  tp2: number;

  // Las tres velas que forman el patrón
  controlBar: Candle; // [2] — barra de control
  ignoredBar: Candle; // [1] — barra ignorada
  signalBar: Candle;  // [0] — barra señal (la que cierra el patrón)
}

export type TrendFilter =
  | "NONE"          // sin filtro (más señales, menos calidad)
  | "SLOW_RISING"   // sólo dirección de la MA lenta
  | "BOTH_RISING";  // ambas MAs en la misma dirección (default — más estricto)

export interface VRIVVIConfig {
  /**
   * Valores de la MA rápida alineados índice a índice con el array de velas.
   * Si el array está vacío se ignora el filtro de tendencia.
   */
  maFastValues: number[];
  /**
   * Valores de la MA lenta alineados índice a índice con el array de velas.
   */
  maSlowValues: number[];

  trendFilter: TrendFilter;

  /** % mínimo del cuerpo respecto al rango total de la barra de control (default 30) */
  minBodyPct: number;

  /**
   * % mínimo de distancia entre el extremo de la barra ignorada y el extremo
   * de la barra de control (mide qué tan "arriba/abajo" está la ignorada dentro
   * de la de control). Equivale a porc_bar_cont del Pine Script (default 30).
   */
  minPositionPct: number;

  /**
   * Si true, la barra señal no puede anular el mínimo (VRI) / máximo (VVI)
   * de la barra ignorada. Equivale a NPAMBI del Pine Script (default false).
   */
  signalCannotBreakIgnored: boolean;

  // Ratios sobre la unidad de riesgo (= rango open→extremo de la barra ignorada)
  ratioBreakEven: number; // default 1
  ratioTP1: number;       // default 2
  ratioTP2: number;       // default 4
}

export const DEFAULT_VRIVVI_CONFIG: VRIVVIConfig = {
  maFastValues: [],
  maSlowValues: [],
  trendFilter: "BOTH_RISING",
  minBodyPct: 30,
  minPositionPct: 30,
  signalCannotBreakIgnored: false,
  ratioBreakEven: 1,
  ratioTP1: 2,
  ratioTP2: 4,
};

// ─── Helpers internos ────────────────────────────────────────────────────────

const isGreen = (c: Candle) => c.close > c.open;
const isRed   = (c: Candle) => c.open  > c.close;

/** Porcentaje del cuerpo respecto al rango total (0-100) */
function bodyPct(c: Candle): number {
  const range = Math.abs(c.high - c.low);
  if (range === 0) return 0;
  return (Math.abs(c.open - c.close) / range) * 100;
}

/**
 * Dirección de la MA en el índice `idx`:
 *   1 = subiendo  |  -1 = bajando  |  0 = plana o sin datos
 */
function maDir(values: number[], idx: number): number {
  if (idx < 1 || idx >= values.length) return 0;
  if (values[idx] > values[idx - 1]) return 1;
  if (values[idx] < values[idx - 1]) return -1;
  return 0;
}

// ─── Función principal ───────────────────────────────────────────────────────

/**
 * Calcula todas las señales VRI/VVI sobre el array de velas dado.
 *
 * Uso típico:
 * ```ts
 * import { calculateVRIVVI, DEFAULT_VRIVVI_CONFIG } from "@/lib/indicators/vri-vvi";
 *
 * const sma8Values  = sma(candles, 8).map(p => p.value);
 * const sma20Values = sma(candles, 20).map(p => p.value);
 *
 * // IMPORTANTE: las MAs devuelven menos puntos que velas porque necesitan
 * // al menos `period` velas para el primer valor. Por eso usamos maFastValues
 * // / maSlowValues alineados con el índice de la vela más reciente.
 * // La función alignMA() a continuación facilita ese alineado.
 *
 * const signals = calculateVRIVVI(candles, {
 *   ...DEFAULT_VRIVVI_CONFIG,
 *   maFastValues: alignMA(candles, sma8Values),
 *   maSlowValues: alignMA(candles, sma20Values),
 * });
 * ```
 */
export function calculateVRIVVI(
  candles: Candle[],
  config: Partial<VRIVVIConfig> = {},
): VRIVVISignal[] {
  const cfg: VRIVVIConfig = { ...DEFAULT_VRIVVI_CONFIG, ...config };
  const signals: VRIVVISignal[] = [];

  // Necesitamos mínimo 3 velas para analizar el patrón
  for (let i = 2; i < candles.length; i++) {
    const c0 = candles[i];     // barra señal
    const c1 = candles[i - 1]; // barra ignorada
    const c2 = candles[i - 2]; // barra de control

    // ── REGLA 1: Patrón de colores ────────────────────────────────────────
    // VRI: Verde → Roja → Verde
    // VVI: Roja  → Verde → Roja
    const isVRI = isGreen(c2) && isRed(c1)   && isGreen(c0);
    const isVVI = isRed(c2)   && isGreen(c1) && isRed(c0);
    if (!isVRI && !isVVI) continue;

    // ── REGLA 2: Ruptura del cuerpo de la barra ignorada ─────────────────
    // VRI: la barra señal supera el open de la ignorada (roja: open > close)
    // VVI: la barra señal cae bajo el open de la ignorada (verde: close > open)
    if (isVRI && c0.high  < c1.open) continue;
    if (isVVI && c0.low   > c1.open) continue;

    // ── REGLA 3: Barra ignorada contenida dentro de la barra de control ──
    // El extremo de la ignorada debe estar dentro del rango de la de control
    if (isVRI && c1.low  <= c2.low)  continue;
    if (isVVI && c1.high >= c2.high) continue;

    // ── REGLA 4: Filtro de tendencia con MAs ─────────────────────────────
    const hasMAs =
      cfg.maFastValues.length > i && cfg.maSlowValues.length > i;

    if (cfg.trendFilter !== "NONE" && hasMAs) {
      const dirSlow = maDir(cfg.maSlowValues, i);
      const dirFast = maDir(cfg.maFastValues, i);

      if (isVRI) {
        // Tendencia alcista requerida
        const ok =
          cfg.trendFilter === "SLOW_RISING"
            ? dirSlow > 0
            : dirSlow > 0 && dirFast > 0;
        if (!ok) continue;
      } else {
        // Tendencia bajista requerida
        const ok =
          cfg.trendFilter === "SLOW_RISING"
            ? dirSlow < 0
            : dirSlow < 0 && dirFast < 0;
        if (!ok) continue;
      }
    }

    // ── REGLA 5: Cuerpo mínimo de la barra de control ────────────────────
    if (bodyPct(c2) < cfg.minBodyPct) continue;

    // ── REGLA 6: Posición de la barra ignorada dentro de la de control ───
    const range2 = Math.abs(c2.high - c2.low);
    if (range2 === 0) continue;

    if (isVRI) {
      // Distancia del low de la ignorada al low de la de control, como % del rango
      const pos = (Math.abs(c1.low - c2.low) / range2) * 100;
      if (pos < cfg.minPositionPct) continue;
    } else {
      // Distancia del high de la ignorada al high de la de control, como % del rango
      const pos = (Math.abs(c1.high - c2.high) / range2) * 100;
      if (pos < cfg.minPositionPct) continue;
    }

    // ── REGLA 7 (opcional): La señal no anula el extremo de la ignorada ──
    if (cfg.signalCannotBreakIgnored) {
      if (isVRI && c0.low  < c1.low)  continue;
      if (isVVI && c0.high > c1.high) continue;
    }

    // ── Cálculo de niveles SL / BE / TP ──────────────────────────────────
    // Unidad de riesgo = distancia del open de la ignorada a su extremo opuesto
    let stopLoss: number, breakEven: number, tp1: number, tp2: number;

    if (isVRI) {
      stopLoss  = c1.low;
      const ur  = Math.abs(c1.open - c1.low);
      breakEven = c1.open + ur * cfg.ratioBreakEven;
      tp1       = c1.open + ur * cfg.ratioTP1;
      tp2       = c1.open + ur * cfg.ratioTP2;
    } else {
      stopLoss  = c1.high;
      const ur  = Math.abs(c1.open - c1.high);
      breakEven = c1.open - ur * cfg.ratioBreakEven;
      tp1       = c1.open - ur * cfg.ratioTP1;
      tp2       = c1.open - ur * cfg.ratioTP2;
    }

    signals.push({
      time:       c0.time,
      type:       isVRI ? "VRI" : "VVI",
      barIndex:   i,
      stopLoss,
      breakEven,
      tp1,
      tp2,
      controlBar: c2,
      ignoredBar: c1,
      signalBar:  c0,
    });
  }

  return signals;
}

/**
 * Alinea los valores de una MA (que tiene menos puntos que velas) con el
 * índice del array de velas completo, rellenando con NaN las posiciones
 * previas al primer valor calculado.
 *
 * Uso:
 * ```ts
 * const sma8pts    = sma(candles, 8);   // IndicatorPoint[]
 * const sma8Values = alignMA(candles, sma8pts.map(p => p.value));
 * ```
 */
export function alignMA(candles: Candle[], maValues: number[]): number[] {
  const pad = candles.length - maValues.length;
  return [...Array(pad).fill(NaN), ...maValues];
}
