import type { PaperPoint } from "./diary-page";
import { measurePair, movePaper, paperSize, wholePaper, type PaperViewport } from "./paper-viewport";

export function createPaperGesture(
  canvas: HTMLCanvasElement,
  cancelInput: () => void,
  redraw: (viewport: PaperViewport) => void,
) {
  let viewport = wholePaper;
  const touches = new Map<number, PaperPoint>();
  let pinching = false;
  let pinch: { viewport: PaperViewport; pair: ReturnType<typeof measurePair> } | undefined;

  function viewPoint(event: PointerEvent): PaperPoint {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * paperSize.width / rect.width,
      y: (event.clientY - rect.top) * paperSize.height / rect.height,
    };
  }

  function pair() {
    const [first, second] = [...touches.values()];
    return first && second ? measurePair(first, second) : undefined;
  }

  function start(): void {
    const measured = pair();
    pinch = measured ? { viewport, pair: measured } : undefined;
  }

  return {
    isInteracting: () => touches.size > 0 || pinching,
    viewPoint,
    down(event: PointerEvent): boolean {
      if (event.pointerType !== "touch") return pinching;
      canvas.setPointerCapture(event.pointerId);
      touches.set(event.pointerId, viewPoint(event));
      if (touches.size >= 2 && !pinching) {
        pinching = true;
        cancelInput();
      }
      if (pinching && !pinch) start();
      return pinching;
    },
    move(event: PointerEvent): boolean {
      if (!touches.has(event.pointerId)) return pinching;
      touches.set(event.pointerId, viewPoint(event));
      if (!pinching) return false;
      const measured = pair();
      if (measured && pinch) {
        viewport = movePaper(pinch.viewport, pinch.pair, measured);
        redraw(viewport);
      }
      return true;
    },
    end(event: PointerEvent): boolean {
      if (!touches.delete(event.pointerId)) return pinching;
      const consumed = pinching;
      start();
      if (!touches.size) pinching = false;
      return consumed;
    },
    reset(): void {
      cancelInput();
      touches.clear();
      pinching = false;
      pinch = undefined;
      viewport = wholePaper;
      redraw(viewport);
    },
  };
}
