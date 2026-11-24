import type { DiaryPage } from "./diary-page";
import type { PhotoAsset } from "./diary-store";
import { drawPhoto, drawStroke } from "./paper-render";
import { decodePhoto } from "./photo-import";

export async function createPageThumbnail(
  page: DiaryPage,
  assets: ReadonlyMap<string, PhotoAsset>,
  decoded?: ReadonlyMap<string, HTMLCanvasElement>,
): Promise<Blob | undefined> {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  function include(x: number, y: number, width: number, height: number): void {
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + width);
    bottom = Math.max(bottom, y + height);
  }

  for (const { position, width, height } of page.photos) include(position.x, position.y, width, height);
  for (const stroke of page.strokes) {
    const radius = stroke.width / 2;
    for (const { x, y } of stroke.points) include(x - radius, y - radius, stroke.width, stroke.width);
  }
  if (!Number.isFinite(left)) return undefined;

  const size = 120;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.fillStyle = "#f7f6f0";
  context.fillRect(0, 0, size, size);
  const scale = (size - 12) / Math.max(48, right - left, bottom - top);
  context.setTransform(scale, 0, 0, scale,
    (size - (left + right) * scale) / 2, (size - (top + bottom) * scale) / 2);

  for (const photo of page.photos) {
    const asset = assets.get(photo.assetId);
    const image = decoded?.get(photo.assetId)
      ?? (asset && await decodePhoto(asset.preview ?? asset.original));
    if (image) drawPhoto(context, photo, image);
  }
  for (const stroke of page.strokes) drawStroke(context, stroke);
  return new Promise((resolve) => canvas.toBlob((image) => resolve(image ?? undefined)));
}
