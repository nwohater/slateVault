"use client";

import { useCallback, useRef } from "react";

interface ResizeHandleProps {
  direction: "vertical" | "horizontal";
  onResize: (delta: number) => void;
}

export function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const startPos = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      startPos.current =
        direction === "vertical" ? e.clientX : e.clientY;

      const onPointerMove = (e: PointerEvent) => {
        const current =
          direction === "vertical" ? e.clientX : e.clientY;
        const delta = current - startPos.current;
        startPos.current = current;
        onResize(delta);
      };

      const onPointerUp = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.body.style.cursor =
        direction === "vertical" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [direction, onResize]
  );

  return (
    <div
      onPointerDown={onPointerDown}
      className={`
        flex-shrink-0 transition-colors group
        ${
          direction === "vertical"
            ? "w-1 cursor-col-resize bg-neutral-800/50 hover:bg-cyan-500/40"
            : "h-1 cursor-row-resize bg-neutral-800/50 hover:bg-cyan-500/40"
        }
      `}
    />
  );
}
