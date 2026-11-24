import type { PaperPoint, Stroke } from "./diary-page";

function distanceSquared(point: PaperPoint, start: PaperPoint, end: PaperPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
  ));
  return (point.x - start.x - fraction * dx) ** 2
    + (point.y - start.y - fraction * dy) ** 2;
}

export function findStrokeAt(strokes: readonly Stroke[], point: PaperPoint): number {
  for (let index = strokes.length - 1; index >= 0; index--) {
    const stroke = strokes[index];
    const radius = stroke.width / 2 + 10;
    if (stroke.points.some((end, pointIndex) =>
      distanceSquared(point, stroke.points[pointIndex - 1] ?? end, end) <= radius ** 2,
    )) return index;
  }
  return -1;
}
