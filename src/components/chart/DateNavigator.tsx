"use client";

import { useState, useRef, useEffect } from "react";
import { CalendarSearch, X, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  /** Callback con el timestamp UTC (segundos) del día seleccionado */
  onNavigate: (timestamp: number) => void;
}

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DAYS_SHORT = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"];

function toNYMidnight(year: number, month: number, day: number): number {
  // Medianoche hora Nueva York → UTC
  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00`;
  const date = new Date(iso + "-05:00"); // EST fijo (suficiente para navegar)
  return Math.floor(date.getTime() / 1000);
}

export function DateNavigator({ onNavigate }: Props) {
  const [open, setOpen]   = useState(false);
  const today             = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected]   = useState<{ y: number; m: number; d: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const btnRef     = useRef<HTMLButtonElement>(null);

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        btnRef.current    && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    const nowYear  = today.getFullYear();
    const nowMonth = today.getMonth();
    if (viewYear > nowYear || (viewYear === nowYear && viewMonth >= nowMonth)) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function buildCalendar() {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Dom
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  function isToday(d: number) {
    return d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  }
  function isFuture(d: number) {
    const cellDate = new Date(viewYear, viewMonth, d);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return cellDate > todayDate;
  }
  function isSelected(d: number) {
    return selected?.y === viewYear && selected?.m === viewMonth && selected?.d === d;
  }

  function handleSelect(d: number) {
    if (isFuture(d)) return;
    setSelected({ y: viewYear, m: viewMonth, d });
    const ts = toNYMidnight(viewYear, viewMonth, d);
    onNavigate(ts);
    setOpen(false);
  }

  const cells = buildCalendar();
  const canGoNext = !(viewYear === today.getFullYear() && viewMonth === today.getMonth());

  const selectedLabel = selected
    ? `${String(selected.d).padStart(2,"0")}/${String(selected.m+1).padStart(2,"0")}/${selected.y}`
    : null;

  return (
    <div className="relative flex items-center">
      {/* Botón trigger */}
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors cursor-pointer
          ${open
            ? "bg-tv-panel-hover text-tv-text"
            : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
          }`}
        title="Ir a una fecha"
      >
        <CalendarSearch className="h-3.5 w-3.5" />
        <span>{selectedLabel ?? "Ir a fecha"}</span>
        {selected && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); setSelected(null); }}
            className="ml-0.5 rounded hover:text-tv-red"
            title="Limpiar"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {/* Popover calendario */}
      {open && (
        <div
          ref={popoverRef}
          className="absolute bottom-full mb-2 left-0 z-50 w-64 rounded-lg border border-tv-border bg-tv-panel shadow-xl"
        >
          {/* Header mes/año */}
          <div className="flex items-center justify-between border-b border-tv-border px-3 py-2">
            <button
              onClick={prevMonth}
              className="rounded p-1 text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-tv-text">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              disabled={!canGoNext}
              className={`rounded p-1 transition-colors
                ${canGoNext
                  ? "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
                  : "cursor-not-allowed opacity-30"
                }`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-tv-text-muted py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Celdas */}
          <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-3">
            {cells.map((d, i) => {
              if (d === null) return <div key={`e-${i}`} />;
              const future   = isFuture(d);
              const todayDay = isToday(d);
              const sel      = isSelected(d);
              return (
                <button
                  key={d}
                  disabled={future}
                  onClick={() => handleSelect(d)}
                  className={`
                    mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium transition-colors
                    ${future
                      ? "cursor-not-allowed text-tv-text-dim opacity-30"
                      : sel
                        ? "bg-tv-blue text-white"
                        : todayDay
                          ? "border border-tv-blue text-tv-blue hover:bg-tv-blue/20"
                          : "text-tv-text hover:bg-tv-panel-hover"
                    }
                  `}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Tip */}
          <div className="border-t border-tv-border px-3 py-2 text-[10px] text-tv-text-dim text-center">
            El gráfico saltará al inicio de ese día
          </div>
        </div>
      )}
    </div>
  );
}
