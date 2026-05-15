"use client";

import { useChartStore } from "@/lib/store/chart-store";
import type { Timeframe } from "@/lib/binance/types";
import { cn } from "@/lib/utils";

const TIMEFRAMES: Timeframe[] = ["1m", "2m", "5m", "10m", "15m", "1h", "4h", "1d", "1w"];

export function TimeframeSelector() {
  const tf = useChartStore((s) => s.timeframe);
  const setTf = useChartStore((s) => s.setTimeframe);
  const symbol = useChartStore((s) => s.symbol);
  const isCrypto = symbol.endsWith("USDT");

  return (
    <div className="flex items-center gap-0.5 rounded bg-tv-bg p-0.5">
      {TIMEFRAMES.map((t) => {
        const disabled = isCrypto && (t === "2m" || t === "10m");
        return (
          <button
            key={t}
            onClick={() => {
              if (!disabled) setTf(t);
            }}
            disabled={disabled}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium uppercase transition-colors",
              tf === t
                ? "bg-tv-panel-hover text-tv-text"
                : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
              disabled && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-tv-text-muted"
            )}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
