import type { PhotoPlacement, Stroke } from "./diary-page";

export function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke): void {
  const [first, ...rest] = stroke.points;
  if (!first) return;
  context.beginPath();
  if (!rest.length) {
    context.fillStyle = stroke.color;
    context.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.moveTo(first.x, first.y);
  for (const point of rest) context.lineTo(point.x, point.y);
  context.stroke();
}

export function drawPhoto(
  context: CanvasRenderingContext2D, photo: PhotoPlacement, image: CanvasImageSource,
): void {
  context.drawImage(image, photo.position.x, photo.position.y, photo.width, photo.height);
}
