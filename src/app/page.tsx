"use client";

import { useRef, useState, useCallback } from "react";
import { Header }                  from "@/components/layout/Header";
import { LeftSidebar }             from "@/components/layout/LeftSidebar";
import { BottomPanel }             from "@/components/layout/BottomPanel";
import { Watchlist }               from "@/components/watchlist/Watchlist";
import { PriceChart }              from "@/components/chart/PriceChart";
import { IndicatorSettingsDialog } from "@/components/chart/IndicatorSettingsDialog";
import { useChartStore }           from "@/lib/store/chart-store";

// ── Límites de redimensión ─────────────────────────────────────────────────────
const DEFAULT_RIGHT_W = 256;
const MIN_RIGHT_W     = 120;
const MAX_RIGHT_W     = 520;
const MIN_CHART_H     = 120;

export default function HomePage() {
  const symbol    = useChartStore((s) => s.symbol);
  const timeframe = useChartStore((s) => s.timeframe);

  const [rightW, setRightW] = useState(DEFAULT_RIGHT_W);
  // chartH: null = flex (ocupa todo), number = altura fija en px
  const [chartH, setChartH] = useState<number | null>(null);

  const chartAreaRef = useRef<HTMLDivElement>(null);

  // ── Drag helpers ───────────────────────────────────────────────────────────
  function startDrag(
    e: React.MouseEvent,
    axis: "x" | "y",
    startValue: number,
    onDelta: (delta: number) => void,
    onEnd?: () => void,
  ) {
    e.preventDefault();
    const startPos = axis === "x" ? e.clientX : e.clientY;
    document.body.style.cursor     = axis === "x" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const pos   = axis === "x" ? ev.clientX : ev.clientY;
      onDelta(pos - startPos);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
      onEnd?.();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  }

  // ── Right sidebar drag ─────────────────────────────────────────────────────
  function onRightHandleMouseDown(e: React.MouseEvent) {
    const startW = rightW;
    startDrag(e, "x", startW, (delta) => {
      // Drag izquierda (delta < 0) → agranda sidebar
      setRightW(Math.min(MAX_RIGHT_W, Math.max(MIN_RIGHT_W, startW - delta)));
    });
  }

  // ── Chart height drag ──────────────────────────────────────────────────────
  function onBottomHandleMouseDown(e: React.MouseEvent) {
    const el      = chartAreaRef.current;
    const startH  = el ? el.getBoundingClientRect().height : 400;
    startDrag(e, "y", startH, (delta) => {
      setChartH(Math.max(MIN_CHART_H, startH + delta));
    });
  }

  const chartStyle: React.CSSProperties = chartH === null
    ? { flex: 1, minHeight: 0 }
    : { height: chartH, minHeight: MIN_CHART_H, flexShrink: 0 };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-tv-bg">
      <Header />

      {/* ── Centro: sidebars + chart ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LeftSidebar />

        {/* ── Área de chart + bottom ── */}
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">

          {/* Chart */}
          <div
            ref={chartAreaRef}
            className="relative w-full"
            style={chartStyle}
          >
            <PriceChart symbol={symbol} timeframe={timeframe} />

            {/* ── Handle inferior (redimensiona altura) ── */}
            <div
              className={[
                "group absolute bottom-0 left-0 z-30 h-2 w-full",
                "cursor-row-resize",
                "bg-transparent hover:bg-tv-blue/30 transition-colors",
              ].join(" ")}
              onMouseDown={onBottomHandleMouseDown}
              onDoubleClick={() => setChartH(null)}
              title="Arrastra para cambiar altura · Doble clic para restablecer"
            >
              {/* Pill */}
              <div className="mx-auto mt-0.5 h-0.5 w-10 rounded-full bg-tv-text-muted
                              opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Bottom panel */}
          <BottomPanel />
        </main>

        {/* ── Sidebar derecho ── */}
        <div
          className="relative flex-shrink-0 border-l border-tv-border bg-tv-panel"
          style={{ width: rightW }}
        >
          {/* ── Handle izquierdo del sidebar (redimensiona ancho) ── */}
          <div
            className={[
              "group absolute left-0 top-0 z-30 h-full w-2",
              "cursor-col-resize",
              "bg-transparent hover:bg-tv-blue/30 transition-colors",
            ].join(" ")}
            onMouseDown={onRightHandleMouseDown}
            onDoubleClick={() => setRightW(DEFAULT_RIGHT_W)}
            title="Arrastra para cambiar ancho · Doble clic para restablecer"
          >
            {/* Pill */}
            <div className="absolute left-0.5 top-1/2 -translate-y-1/2 h-10 w-0.5
                            rounded-full bg-tv-text-muted
                            opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          <aside className="h-full overflow-hidden">
            <Watchlist />
          </aside>
        </div>
      </div>

      <IndicatorSettingsDialog />
    </div>
  );
}
