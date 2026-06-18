"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Timeframe } from "@/lib/binance/types";

export type IndicatorKey =
  | "sma8"
  | "sma20"
  | "sma200"
  | "rsi"
  | "macd"
  | "volume"
  | "fantastic4"
  | "openingPosition"
  | "vriVvi"
  // ─── Tamaño de vela ───────────────────────────────────────────────────────
  | "tamPequena"
  | "tamNormal"
  | "tamEB"
  | "tamEBPlus"
  | "tamDual"
  | "tamViolencia"
  | "rbiGbi"
  | "cambioColor"
  | "velaElefante"
  | "ebConfirmada"
  | "ebPlusEvent"
  | "ebDualEvent"
  | "ebViolentaEvent";

export type DrawingTool = "cursor" | "hline" | "measure" | "eraser";

export interface PriceLine {
  id: string;
  symbol: string;
  price: number;
}

export interface IndicatorConfig {
  sma8: number;
  sma20: number;
  sma200: number;
  rsi: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
}

export const DEFAULT_CONFIG: IndicatorConfig = {
  sma8: 8,
  sma20: 20,
  sma200: 200,
  rsi: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
};

export const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  sma8: "#26a69a",
  sma20: "#2962ff",
  sma200: "#ef5350",
  rsi: "#ab47bc",
  macd: "#2962ff",
  volume: "#787b86",
  fantastic4:       "#ffb74d",
  openingPosition:  "#4db6ac",
  vriVvi:           "#00C853",
  // Tamaño de vela
  tamPequena:   "#78909c",
  tamNormal:    "#b0bec5",
  tamEB:        "#ffb74d",
  tamEBPlus:    "#ff7043",
  tamDual:      "#ef5350",
  tamViolencia: "#ab47bc",
  rbiGbi:       "#FF9100",
  cambioColor:  "#00E5FF",
  velaElefante: "#0AAC00",
  ebConfirmada:    "#ffb74d",
  ebPlusEvent:     "#ff7043",
  ebDualEvent:     "#ef5350",
  ebViolentaEvent: "#ab47bc",
};

export const DEFAULT_WATCHLIST = [
  "AAPL",
  "AAPU",
  "AMZN",
  "AMZU",
  "AMDL",
  "NKE",
  "NFLX",
  "UBER",
  "HOOD",
  "CSCO",
  "NVDA",
  "NVDL",
  "DIS",
  "VZ",
  "MSTR",
  "COIN",
  "STRC",
  "XOM",
  "C",
  "BTCUSDT"
];

// ─── Chart appearance ──────────────────────────────────────────────────────────
export type ChartTheme = "dark" | "light";

interface ChartState {
  symbol: string;
  timeframe: Timeframe;
  /** Indicator is added to the chart (appears in pill + renders unless hidden) */
  indicators: Record<IndicatorKey, boolean>;
  /** Indicator is hidden (eye icon off) — kept in pill list, just not rendered */
  hidden: Record<IndicatorKey, boolean>;
  /** Periods and parameters for each indicator */
  config: IndicatorConfig;
  watchlist: string[];

  // ─── Appearance ───────────────────────────────────────────────────────────
  /** Dark (negro) or light (blanco) background */
  chartTheme: ChartTheme;
  /** Show/hide horizontal price grid lines */
  showPriceLines: boolean;
  /** Show/hide vertical time grid lines */
  showTimeLines: boolean;

  // Ephemeral UI state (not persisted)
  tool: DrawingTool;
  priceLines: PriceLine[];
  symbolDialogOpen: boolean;
  /** Which indicator's settings dialog is open (null = closed) */
  settingsTarget: IndicatorKey | null;

  // Actions
  setSymbol: (s: string) => void;
  setTimeframe: (t: Timeframe) => void;
  toggleIndicator: (key: IndicatorKey) => void;
  removeIndicator: (key: IndicatorKey) => void;
  toggleHidden: (key: IndicatorKey) => void;
  setConfig: (patch: Partial<IndicatorConfig>) => void;
  addToWatchlist: (s: string) => void;
  removeFromWatchlist: (s: string) => void;
  setTool: (t: DrawingTool) => void;
  addPriceLine: (price: number, symbol: string) => void;
  clearPriceLines: (symbol?: string) => void;
  setSymbolDialogOpen: (v: boolean) => void;
  setSettingsTarget: (k: IndicatorKey | null) => void;
  /** Timestamp UTC (segundos) al que navegar. null = sin acción pendiente */
  targetDate: number | null;
  setTargetDate: (ts: number | null) => void;
  // ─── Appearance actions ───────────────────────────────────────────────────
  toggleChartTheme: () => void;
  togglePriceLines: () => void;
  toggleTimeLines: () => void;
}

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      symbol: "AAPL",
      timeframe: "15m" as Timeframe,
      indicators: {
        sma8: true,
        sma20: true,
        sma200: false,
        rsi: true,
        macd: false,
        volume: true,
        fantastic4:       false,
        openingPosition:  false,
        vriVvi:           false,
        tamPequena:   false,
        tamNormal:    false,
        tamEB:        false,
        tamEBPlus:    false,
        tamDual:      false,
        tamViolencia: false,
        rbiGbi:       false,
        cambioColor:  false,
        velaElefante: false,
        ebConfirmada:    false,
        ebPlusEvent:     false,
        ebDualEvent:     false,
        ebViolentaEvent: false,
      },
      hidden: {
        sma8:             false,
        sma20:            false,
        sma200:           false,
        rsi:              false,
        macd:             false,
        volume:           false,
        fantastic4:       false,
        openingPosition:  false,
        vriVvi:           false,
        tamPequena:   false,
        tamNormal:    false,
        tamEB:        false,
        tamEBPlus:    false,
        tamDual:      false,
        tamViolencia: false,
        rbiGbi:       false,
        cambioColor:  false,
        velaElefante: false,
        ebConfirmada:    false,
        ebPlusEvent:     false,
        ebDualEvent:     false,
        ebViolentaEvent: false,
      },
      config: { ...DEFAULT_CONFIG },
      watchlist: DEFAULT_WATCHLIST,

      // ─── Appearance defaults ─────────────────────────────────────────────
      chartTheme: "dark",
      showPriceLines: true,
      showTimeLines: true,

      tool: "cursor",
      priceLines: [],
      symbolDialogOpen: false,
      settingsTarget: null,

      setSymbol: (symbol) => set({ symbol }),
      setTimeframe: (timeframe) => set({ timeframe }),
      toggleIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: !s.indicators[key] },
          hidden: !s.indicators[key]
            ? { ...s.hidden, [key]: false }
            : s.hidden,
        })),
      removeIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: false },
          hidden: { ...s.hidden, [key]: false },
        })),
      toggleHidden: (key) =>
        set((s) => ({ hidden: { ...s.hidden, [key]: !s.hidden[key] } })),
      setConfig: (patch) =>
        set((s) => ({ config: { ...s.config, ...patch } })),
      addToWatchlist: (s) =>
        set((state) => ({
          watchlist: state.watchlist.includes(s)
            ? state.watchlist
            : [...state.watchlist, s],
        })),
      removeFromWatchlist: (s) =>
        set((state) => ({
          watchlist: state.watchlist.filter((x) => x !== s),
        })),
      setTool: (tool) => set({ tool }),
      addPriceLine: (price, symbol) =>
        set((state) => ({
          priceLines: [
            ...state.priceLines,
            {
              id:
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random()}`,
              symbol,
              price,
            },
          ],
        })),
      clearPriceLines: (symbol) =>
        set((state) => ({
          priceLines: symbol
            ? state.priceLines.filter((p) => p.symbol !== symbol)
            : [],
        })),
      setSymbolDialogOpen: (symbolDialogOpen) => set({ symbolDialogOpen }),
      setSettingsTarget: (settingsTarget) => set({ settingsTarget }),
      targetDate: null,
      setTargetDate: (targetDate) => set({ targetDate }),

      // ─── Appearance actions ───────────────────────────────────────────────
      toggleChartTheme: () =>
        set((s) => ({ chartTheme: s.chartTheme === "dark" ? "light" : "dark" })),
      togglePriceLines: () =>
        set((s) => ({ showPriceLines: !s.showPriceLines })),
      toggleTimeLines: () =>
        set((s) => ({ showTimeLines: !s.showTimeLines })),
    }),
    {
      name: "tv-gratis-chart-state",
      partialize: (s) => ({
        symbol: s.symbol,
        timeframe: s.timeframe,
        indicators: s.indicators,
        hidden: s.hidden,
        config: s.config,
        watchlist: s.watchlist,
        chartTheme: s.chartTheme,
        showPriceLines: s.showPriceLines,
        showTimeLines: s.showTimeLines,
      }),
    },
  ),
);
