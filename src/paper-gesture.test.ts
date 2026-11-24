import { expect, test, vi } from "vitest";
import { createPaperGesture } from "./paper-gesture";
import { wholePaper, type PaperViewport } from "./paper-viewport";

test("two fingers cancel input, clamp movement, and return to the whole paper", () => {
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 800 }),
    setPointerCapture: vi.fn(),
  } as unknown as HTMLCanvasElement;
  const cancel = vi.fn();
  let viewport: PaperViewport = wholePaper;
  const gesture = createPaperGesture(canvas, cancel, (next) => { viewport = next; });
  const pointer = (id: number, x: number, y: number) => ({
    pointerId: id, pointerType: "touch", clientX: x, clientY: y,
  }) as PointerEvent;
  expect(gesture.down(pointer(1, 200, 300))).toBe(false);
  expect(gesture.down(pointer(2, 400, 300))).toBe(true);
  expect(cancel).toHaveBeenCalledTimes(1);
  gesture.move(pointer(1, 100, 300));
  gesture.move(pointer(2, 500, 300));
  expect(viewport.scale).toBe(2);
  expect(viewport.offset).toEqual({ x: -300, y: -300 });
  gesture.move(pointer(1, 200, 300));
  gesture.move(pointer(2, 400, 300));
  expect(viewport).toEqual(wholePaper);
  expect(gesture.end(pointer(1, 200, 300))).toBe(true);
  expect(gesture.move(pointer(2, 450, 300))).toBe(true);
  expect(viewport).toEqual(wholePaper);
  expect(gesture.end(pointer(2, 450, 300))).toBe(true);
  expect(gesture.down(pointer(3, 300, 300))).toBe(false);
});
