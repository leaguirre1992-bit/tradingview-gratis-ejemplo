"use client";

import { useCallback, useEffect, useRef } from "react";

interface Props {
  /** "vertical" = handle en borde derecho → redimensiona ancho horizontal */
  direction: "vertical" | "horizontal";
  /** Callback con el nuevo tamaño en px */
  onResize: (newSize: number) => void;
  /** Elemento cuyo tamaño se mide (ref externo) */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Si se mide el opuesto (ej: drag a la derecha → achica el panel derecho) */
  inverse?: boolean;
}

export function ResizeHandle({ direction, onResize, targetRef, inverse }: Props) {
  const dragging = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(0);

  const isVertical = direction === "vertical"; // handle en borde derecho = redimensiona width
  const cursor = isVertical ? "col-resize" : "row-resize";

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startPos.current  = isVertical ? e.clientX : e.clientY;
      const el = targetRef.current;
      startSize.current = el
        ? isVertical ? el.getBoundingClientRect().width
                     : el.getBoundingClientRect().height
        : 0;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const pos  = isVertical ? ev.clientX : ev.clientY;
        const delta = pos - startPos.current;
        const newSize = inverse
          ? startSize.current - delta
          : startSize.current + delta;
        onResize(Math.max(40, newSize)); // mínimo 40px
      };

      const onUp = () => {
        dragging.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = cursor;
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [cursor, inverse, isVertical, onResize, targetRef],
  );

  return (
    <div
      onMouseDown={onMouseDown}
      style={{ cursor }}
      className={[
        "group absolute z-30 flex items-center justify-center",
        "transition-colors",
        // Posición y tamaño del handle según dirección
        isVertical
          ? "right-0 top-0 h-full w-1 hover:w-1.5"   // borde derecho
          : "bottom-0 left-0 h-1 w-full hover:h-1.5", // borde inferior
        // Color base invisible, visible al hover/drag
        "bg-transparent hover:bg-tv-blue/50",
      ].join(" ")}
    >
      {/* Indicador visual central */}
      <div
        className={[
          "rounded-full bg-tv-text-muted opacity-0 transition-opacity group-hover:opacity-100",
          isVertical ? "h-8 w-0.5" : "h-0.5 w-8",
        ].join(" ")}
      />
    </div>
  );
}
