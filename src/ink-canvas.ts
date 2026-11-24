import { createPaperGesture } from "./paper-gesture";
import type { BrushSettings } from "./brush-settings";
import type { PaperPoint, Stroke } from "./diary-page";
import { drawStroke } from "./paper-render";
import { paperSize, toPaperPoint, wholePaper, visiblePaper } from "./paper-viewport";
import { findStrokeAt } from "./stroke-hit";
import "./ink-canvas.css";

export function createInkCanvas(
  initialStrokes: readonly Stroke[],
  onChange: (strokes: readonly Stroke[]) => void,
  getBrush: () => BrushSettings,
  isErasing: () => boolean,
  isPlacingPhotos: () => boolean,
  drawPhotos: (context: CanvasRenderingContext2D) => void,
  photoGesture: {
    begin: (point: PaperPoint) => void;
    move: (point: PaperPoint) => void;
    end: (point: PaperPoint) => void;
    cancel: () => void;
  },
) {
  const canvas = document.createElement("canvas");
  canvas.className = "ink-canvas";
  canvas.width = paperSize.width;
  canvas.height = paperSize.height;
  canvas.setAttribute("aria-label", "日记画纸");

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  const pen = context;
  let committed = initialStrokes;
  let viewport = wholePaper;
  let photoPointer: number | undefined;
  let pendingErase: { id: number; point: PaperPoint } | undefined;
  let active: { id: number; points: PaperPoint[]; ink: BrushSettings } | undefined;

  function dot(point: PaperPoint, stroke: Pick<Stroke, "color" | "width">): void {
    drawStroke(pen, { ...stroke, points: [point] });
  }

  function redraw(): void {
    pen.resetTransform();
    pen.clearRect(0, 0, paperSize.width, paperSize.height);
    pen.setTransform(viewport.scale, 0, 0, viewport.scale, viewport.offset.x, viewport.offset.y);
    drawPhotos(pen);
    for (const stroke of committed) drawStroke(pen, stroke);
  }

  function toPaper(event: PointerEvent): PaperPoint {
    const point = toPaperPoint(gesture.viewPoint(event), viewport);
    return {
      x: Math.min(paperSize.width, Math.max(0, point.x)),
      y: Math.min(paperSize.height, Math.max(0, point.y)),
    };
  }

  const gesture = createPaperGesture(canvas, () => {
    active = undefined;
    pendingErase = undefined;
    if (photoPointer !== undefined) photoGesture.cancel();
    photoPointer = undefined;
    redraw();
  }, (next) => {
    viewport = next;
    redraw();
  });

  function extend(event: PointerEvent): void {
    if (!active || event.pointerId !== active.id) return;
    const next = toPaper(event);
    const last = active.points[active.points.length - 1];
    if (last.x === next.x && last.y === next.y) return;
    active.points.push(next);
    pen.strokeStyle = active.ink.color;
    pen.lineWidth = active.ink.width;
    pen.lineCap = "round";
    pen.beginPath();
    pen.moveTo(last.x, last.y);
    pen.lineTo(next.x, next.y);
    pen.stroke();
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (gesture.down(event)) return;
    if (active || pendingErase || photoPointer !== undefined) return;
    if (event.pointerType !== "touch") canvas.setPointerCapture(event.pointerId);
    const start = toPaper(event);
    if (isPlacingPhotos()) {
      photoPointer = event.pointerId;
      photoGesture.begin(start);
      return;
    }
    if (isErasing()) {
      pendingErase = { id: event.pointerId, point: start };
      return;
    }

    active = { id: event.pointerId, points: [start], ink: { ...getBrush() } };
    dot(start, active.ink);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (gesture.move(event)) return;
    if (photoPointer === event.pointerId) photoGesture.move(toPaper(event));
    else extend(event);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (gesture.end(event)) return;
    if (photoPointer === event.pointerId) {
      photoPointer = undefined;
      photoGesture.end(toPaper(event));
      return;
    }
    if (pendingErase?.id === event.pointerId) {
      const hit = findStrokeAt(committed, pendingErase.point);
      pendingErase = undefined;
      if (hit >= 0) onChange(committed.filter((_, index) => index !== hit));
      return;
    }
    if (!active || event.pointerId !== active.id) return;
    extend(event);
    const stroke = { ...active.ink, points: active.points };
    active = undefined;
    onChange([...committed, stroke]);
  });

  function cancel(event: PointerEvent): void {
    if (gesture.end(event)) return;
    if (photoPointer === event.pointerId) {
      photoPointer = undefined;
      photoGesture.cancel();
    }
    if (pendingErase?.id === event.pointerId) pendingErase = undefined;
    if (active?.id !== event.pointerId) return;
    active = undefined;
    redraw();
  }

  canvas.addEventListener("paper-reset", () => gesture.reset());
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("lostpointercapture", cancel);
  redraw();
  return {
    canvas,
    redraw,
    visiblePaper: () => visiblePaper(viewport),
    isInteracting: () => !!active || !!pendingErase || photoPointer !== undefined || gesture.isInteracting(),
    resetViewport: () => gesture.reset(),
    replaceStrokes(strokes: readonly Stroke[]) {
      active = undefined;
      pendingErase = undefined;
      committed = strokes;
      redraw();
    },
  };
}
