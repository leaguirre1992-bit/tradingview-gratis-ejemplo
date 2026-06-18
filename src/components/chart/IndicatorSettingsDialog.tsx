"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useChartStore,
  DEFAULT_CONFIG,
  type IndicatorKey,
} from "@/lib/store/chart-store";

const TITLES: Record<IndicatorKey, string> = {
  sma8: "SMA — Slot 1",
  sma20: "SMA — Slot 2",
  sma200: "SMA — Slot 3",
  rsi: "RSI",
  macd: "MACD",
  volume: "Volumen",
  fantastic4:       "4 Fantásticos",
  openingPosition:  "Posición en Apertura",
  vriVvi:           "VRI / VVI — Oliver Velez",
  tamPequena:   "Tamaño — Pequeña",
  tamNormal:    "Tamaño — Normal",
  tamEB:        "Tamaño — EB",
  tamEBPlus:    "Tamaño — EB+",
  tamDual:      "Tamaño — Dual",
  tamViolencia: "Tamaño — Violencia",
  rbiGbi:       "RBI & GBI — Oliver Velez",
  cambioColor:  "Cambio de color — Oliver Velez",
  velaElefante: "Vela Elefante — Alejandro Iovane / Dreadblitz",
  ebConfirmada:    "EB confirmada — Oliver Velez",
  ebPlusEvent:     "EB+ — Oliver Velez",
  ebDualEvent:     "EB dual — Oliver Velez",
  ebViolentaEvent: "EB violenta — Oliver Velez",
};

export function IndicatorSettingsDialog() {
  const target = useChartStore((s) => s.settingsTarget);
  const setTarget = useChartStore((s) => s.setSettingsTarget);
  const config = useChartStore((s) => s.config);
  const setConfig = useChartStore((s) => s.setConfig);

  const open = target !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setTarget(null);
      }}
    >
      <DialogContent className="max-w-sm bg-tv-panel">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {target ? TITLES[target] : ""} — Configuración
          </DialogTitle>
        </DialogHeader>
        {target && (
          <SettingsForm
            target={target}
            config={config}
            onSave={(patch) => {
              setConfig(patch);
              setTarget(null);
            }}
            onReset={() => {
              setConfig(DEFAULT_CONFIG);
              setTarget(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormProps {
  target: IndicatorKey;
  config: typeof DEFAULT_CONFIG;
  onSave: (patch: Partial<typeof DEFAULT_CONFIG>) => void;
  onReset: () => void;
}

function SettingsForm({ target, config, onSave, onReset }: FormProps) {
  // Local draft state to avoid recalculating chart on every keystroke
  const [draft, setDraft] = useState({
    sma8: config.sma8,
    sma20: config.sma20,
    sma200: config.sma200,
    rsi: config.rsi,
    macdFast: config.macdFast,
    macdSlow: config.macdSlow,
    macdSignal: config.macdSignal,
  });

  useEffect(() => {
    setDraft({
      sma8: config.sma8,
      sma20: config.sma20,
      sma200: config.sma200,
      rsi: config.rsi,
      macdFast: config.macdFast,
      macdSlow: config.macdSlow,
      macdSignal: config.macdSignal,
    });
  }, [config, target]);

  function save() {
    if (target === "sma8") onSave({ sma8: clamp(draft.sma8, 2, 500) });
    else if (target === "sma20") onSave({ sma20: clamp(draft.sma20, 2, 500) });
    else if (target === "sma200") onSave({ sma200: clamp(draft.sma200, 2, 500) });
    else if (target === "rsi") onSave({ rsi: clamp(draft.rsi, 2, 100) });
    else if (target === "macd")
      onSave({
        macdFast: clamp(draft.macdFast, 2, 100),
        macdSlow: clamp(draft.macdSlow, 2, 200),
        macdSignal: clamp(draft.macdSignal, 2, 100),
      });
    else if (target === "volume") onSave({});
    else if (target === "fantastic4") onSave({});
    else if (target === "openingPosition") onSave({});
    else if (target === "vriVvi") onSave({});
    else if (target === "tamPequena")   onSave({});
    else if (target === "tamNormal")    onSave({});
    else if (target === "tamEB")        onSave({});
    else if (target === "tamEBPlus")    onSave({});
    else if (target === "tamDual")      onSave({});
    else if (target === "tamViolencia") onSave({});
    else if (target === "rbiGbi")       onSave({});
    else if (target === "cambioColor")  onSave({});
    else if (target === "velaElefante") onSave({});
    else if (target === "ebConfirmada")    onSave({});
    else if (target === "ebPlusEvent")     onSave({});
    else if (target === "ebDualEvent")     onSave({});
    else if (target === "ebViolentaEvent") onSave({});
  }

  return (
    <div className="flex flex-col gap-3">
      {(target === "sma8" || target === "sma20" || target === "sma200") && (
        <Field
          label="Longitud"
          value={draft[target]}
          onChange={(n) => setDraft((d) => ({ ...d, [target]: n }))}
        />
      )}
      {target === "rsi" && (
        <Field
          label="Período"
          value={draft.rsi}
          onChange={(n) => setDraft((d) => ({ ...d, rsi: n }))}
        />
      )}
      {target === "macd" && (
        <div className="grid grid-cols-3 gap-2">
          <Field
            label="Rápida"
            value={draft.macdFast}
            onChange={(n) => setDraft((d) => ({ ...d, macdFast: n }))}
          />
          <Field
            label="Lenta"
            value={draft.macdSlow}
            onChange={(n) => setDraft((d) => ({ ...d, macdSlow: n }))}
          />
          <Field
            label="Señal"
            value={draft.macdSignal}
            onChange={(n) => setDraft((d) => ({ ...d, macdSignal: n }))}
          />
        </div>
      )}
      {target === "volume" && (
        <p className="text-xs text-tv-text-muted">
          El indicador de volumen no tiene parámetros configurables en esta
          versión.
        </p>
      )}
      {target === "fantastic4" && (
        <p className="text-xs text-tv-text-muted">
          Clasifica los últimos 30 min del día anterior en: Estrecho, Contraído,
          Normal, Amplio o 3F Contraídos. No tiene parámetros configurables.
        </p>
      )}
      {target === "openingPosition" && (
        <p className="text-xs text-tv-text-muted">
          Dibuja las 7 zonas de posición en apertura durante los primeros 40 min
          del día (09:30–10:10 NY), basadas en los 4F del día anterior.
          No tiene parámetros configurables.
        </p>
      )}
      {target === "vriVvi" && (
        <p className="text-xs text-tv-text-muted">
          Detecta el patrón de 3 velas VRI (Vela Roja Ignorada 🐂) y VVI
          (Vela Verde Ignorada 🐻) de Oliver Velez. Usa SMA 8 y SMA 20 como
          filtro de tendencia. No tiene parámetros configurables aquí.
        </p>
      )}
      {target === "rbiGbi" && (
        <p className="text-xs text-tv-text-muted">
          Detecta los eventos RBI (Red Bar Ignored 🐂) y GBI (Green Bar Ignored 🐻)
          de Oliver Velez, donde la primera vela (barra de control) es de tamaño EB,
          EB+ o Dual. Usa SMA 8 y SMA 20 como filtro de tendencia.
          No tiene parámetros configurables.
        </p>
      )}
      {target === "cambioColor" && (
        <p className="text-xs text-tv-text-muted">
          Detecta los eventos Cambio de Color Verde (Roja → Verde 🟢) y Cambio de Color Rojo
          (Verde → Roja 🔴), donde la vela ignorada c1 es de tamaño pequeño o normal y
          la vela de señal c2 rompe su extremo por al menos 1 centavo con un cuerpo de al menos 30%.
          Usa SMA 8 y SMA 20 como filtro de tendencia. No tiene parámetros configurables.
        </p>
      )}
      {target === "velaElefante" && (
        <p className="text-xs text-tv-text-muted">
          Detecta las Velas Elefante (VE_X) de Oliver Velez adaptado por Alejandro Iovane / Dreadblitz.
          Filtra velas cuyo cuerpo represente al menos el 70% de su rango completo, con un tamaño de cuerpo
          que supere 1.3 veces el ATR histórico de 100 periodos. Aplica filtro de tendencia usando SMA 8.
          No tiene parámetros configurables en esta interfaz.
        </p>
      )}
      {target === "ebConfirmada" && (
        <p className="text-xs text-tv-text-muted">
          Filtra las Velas Elefante (VE_X) de Oliver Velez adaptadas por Alejandro Iovane / Dreadblitz
          que tengan exactamente un tamaño de tipo EB. No tiene parámetros configurables.
        </p>
      )}
      {target === "ebPlusEvent" && (
        <p className="text-xs text-tv-text-muted">
          Filtra las Velas Elefante (VE_X) de Oliver Velez adaptadas por Alejandro Iovane / Dreadblitz
          que tengan exactamente un tamaño de tipo EB+. No tiene parámetros configurables.
        </p>
      )}
      {target === "ebDualEvent" && (
        <p className="text-xs text-tv-text-muted">
          Filtra las Velas Elefante (VE_X) de Oliver Velez adaptadas por Alejandro Iovane / Dreadblitz
          que tengan exactamente un tamaño de tipo EB dual. No tiene parámetros configurables.
        </p>
      )}
      {target === "ebViolentaEvent" && (
        <p className="text-xs text-tv-text-muted">
          Filtra las Velas Elefante (VE_X) de Oliver Velez adaptadas por Alejandro Iovane / Dreadblitz
          que tengan exactamente un tamaño de tipo EB violenta. No tiene parámetros configurables.
        </p>
      )}
      {(target === "tamPequena" || target === "tamNormal" || target === "tamEB" ||
        target === "tamEBPlus" || target === "tamDual" || target === "tamViolencia") && (
        <p className="text-xs text-tv-text-muted">
          Plotea un punto de color sobre cada vela cuyo cuerpo corresponda a
          este tamaño. El tamaño se calcula como múltiplo de la barra normal
          del día (mediana de cuerpos): Pequeña &lt;×0.75 · Normal ×1 · EB ×2 ·
          EB+ ×3 · Dual ×4 · Violencia ×6+. No tiene parámetros configurables.
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-tv-text-muted hover:text-tv-text"
        >
          Reset defaults
        </Button>
        <Button size="sm" onClick={save} className="bg-tv-blue hover:bg-tv-blue/90">
          Aplicar
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <Input
        type="number"
        min={2}
        max={500}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(n);
        }}
        className="bg-tv-bg tabular-nums"
      />
    </label>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
