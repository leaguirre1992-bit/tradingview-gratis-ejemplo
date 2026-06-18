"use client";

import { Code2, Zap, Sun, Moon, Grid2x2, Grid2x2X } from "lucide-react";
import { SymbolSelector } from "@/components/chart/SymbolSelector";
import { TimeframeSelector } from "@/components/chart/TimeframeSelector";
import { IndicatorMenu } from "@/components/chart/IndicatorMenu";
import { Separator } from "@/components/ui/separator";
import { useChartStore } from "@/lib/store/chart-store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Header() {
  const chartTheme     = useChartStore((s) => s.chartTheme);
  const showPriceLines = useChartStore((s) => s.showPriceLines);
  const showTimeLines  = useChartStore((s) => s.showTimeLines);
  const toggleChartTheme = useChartStore((s) => s.toggleChartTheme);
  const togglePriceLines = useChartStore((s) => s.togglePriceLines);
  const toggleTimeLines  = useChartStore((s) => s.toggleTimeLines);

  const isLight = chartTheme === "light";

  return (
    <header className="flex h-12 items-center justify-between border-b border-tv-border bg-tv-panel px-3">
      <div className="flex items-center gap-1">
        {/* Logo */}
        <div className="flex items-center gap-2 pr-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-tv-blue/20">
            <Zap className="h-4 w-4 text-tv-blue" />
          </div>
          <span className="text-sm font-semibold text-tv-text">
            TradingView <span className="text-tv-text-muted">Gratis</span>
          </span>
        </div>

        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <SymbolSelector />
        <Separator orientation="vertical" className="h-6 bg-tv-border" />
        <TimeframeSelector />
        <Separator orientation="vertical" className="mx-1 h-6 bg-tv-border" />
        <IndicatorMenu />
        <Separator orientation="vertical" className="mx-1 h-6 bg-tv-border" />

        {/* ── Appearance controls ─────────────────────────────────────────── */}

        {/* Dark / Light background */}
        <Tooltip>
          <TooltipTrigger
            onClick={toggleChartTheme}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors cursor-pointer
              ${isLight
                ? "bg-tv-panel-hover text-tv-text"
                : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
              }`}
            aria-label="Cambiar fondo del gráfico"
          >
            {isLight
              ? <Sun  className="h-3.5 w-3.5 text-tv-yellow" />
              : <Moon className="h-3.5 w-3.5" />}
            <span>{isLight ? "Blanco" : "Negro"}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isLight ? "Cambiar a fondo negro" : "Cambiar a fondo blanco"}
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-6 bg-tv-border" />

        {/* Price grid lines (horizontal) */}
        <Tooltip>
          <TooltipTrigger
            onClick={togglePriceLines}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors cursor-pointer
              ${showPriceLines
                ? "bg-tv-panel-hover text-tv-text"
                : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
              }`}
            aria-label="Mostrar/ocultar líneas de precio"
          >
            {showPriceLines
              ? <Grid2x2  className="h-3.5 w-3.5 text-tv-blue" />
              : <Grid2x2X className="h-3.5 w-3.5" />}
            <span>Precio</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {showPriceLines ? "Ocultar líneas de precio" : "Mostrar líneas de precio"}
          </TooltipContent>
        </Tooltip>

        {/* Time grid lines (vertical) */}
        <Tooltip>
          <TooltipTrigger
            onClick={toggleTimeLines}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors cursor-pointer
              ${showTimeLines
                ? "bg-tv-panel-hover text-tv-text"
                : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
              }`}
            aria-label="Mostrar/ocultar líneas de fecha"
          >
            {showTimeLines
              ? <Grid2x2  className="h-3.5 w-3.5 text-tv-blue rotate-90" />
              : <Grid2x2X className="h-3.5 w-3.5 rotate-90" />}
            <span>Fecha</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {showTimeLines ? "Ocultar líneas de fecha" : "Mostrar líneas de fecha"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>Source</span>
        </a>
      </div>
    </header>
  );
}
