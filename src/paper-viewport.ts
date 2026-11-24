import type { PaperPoint } from "./diary-page";

export interface PaperViewport {
  readonly scale: number;
  readonly offset: PaperPoint;
}

interface TouchPair {
  readonly center: PaperPoint;
  readonly distance: number;
}

export const paperSize = { width: 600, height: 800 };
export const wholePaper: PaperViewport = { scale: 1, offset: { x: 0, y: 0 } };

export function measurePair(first: PaperPoint, second: PaperPoint): TouchPair {
  return {
    center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.hypot(first.x - second.x, first.y - second.y),
  };
}

export function toPaperPoint(point: PaperPoint, viewport: PaperViewport): PaperPoint {
  return {
    x: (point.x - viewport.offset.x) / viewport.scale,
    y: (point.y - viewport.offset.y) / viewport.scale,
  };
}

export function movePaper(
  initial: PaperViewport,
  start: TouchPair,
  current: TouchPair,
): PaperViewport {
  const scale = Math.min(4, Math.max(1, initial.scale * current.distance / Math.max(1, start.distance)));
  if (scale === 1) return wholePaper;
  const anchor = toPaperPoint(start.center, initial);
  return {
    scale,
    offset: {
      x: Math.max(paperSize.width * (1 - scale), Math.min(0, current.center.x - anchor.x * scale)),
      y: Math.max(paperSize.height * (1 - scale), Math.min(0, current.center.y - anchor.y * scale)),
    },
  };
}

export interface VisiblePaper {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function visiblePaper(viewport: PaperViewport): VisiblePaper {
  const first = toPaperPoint({ x: 0, y: 0 }, viewport);
  const last = toPaperPoint({ x: paperSize.width, y: paperSize.height }, viewport);
  const x = Math.max(0, first.x);
  const y = Math.max(0, first.y);
  return {
    x, y,
    width: Math.max(0, Math.min(paperSize.width, last.x) - x),
    height: Math.max(0, Math.min(paperSize.height, last.y) - y),
  };
}
