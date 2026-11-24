import type { PhotoAsset } from "./diary-store";
import type { PhotoPlacement } from "./diary-page";

export interface PreparedPhoto {
  readonly asset: PhotoAsset;
  readonly image: HTMLCanvasElement;
}

export async function decodePhoto(source: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(source);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const display = document.createElement("canvas");
    display.width = Math.max(1, Math.round(image.naturalWidth * scale));
    display.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = display.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable.");
    // Copy the pixels while the decoded image still has a live object URL.
    context.drawImage(image, 0, 0, display.width, display.height);
    return display;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function makeDisplayPhoto(file: File): Promise<PreparedPhoto> {
  const display = await decodePhoto(file);
  // Camera photos benefit from JPEG; keep transparency for other image types.
  const format = /image\/(?:jpeg|heic|heif)$/i.test(file.type) ? "image/jpeg" : "image/png";
  const preview = await new Promise<Blob>((resolve, reject) => {
    display.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Cannot encode preview.")),
      format, 0.9);
  });
  return { asset: { id: crypto.randomUUID(), original: file, preview }, image: display };
}

export async function preparePhotos(
  files: readonly File[],
  draftBytes: number,
): Promise<PreparedPhoto[]> {
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  const available = estimate?.quota !== undefined && estimate.usage !== undefined
    ? estimate.quota - estimate.usage
    : Infinity;
  let bytes = draftBytes + files.reduce((total, file) => total + file.size, 0);
  const ensureSpace = () => {
    if (bytes > available) throw new DOMException("Not enough storage.", "QuotaExceededError");
  };

  ensureSpace();
  const photos: PreparedPhoto[] = [];
  for (const file of files) {
    const photo = await makeDisplayPhoto(file);
    bytes += photo.asset.preview?.size ?? 0;
    ensureSpace();
    photos.push(photo);
  }
  return photos;
}

export function placeImportedPhoto(photo: PreparedPhoto, index: number): PhotoPlacement {
  const image = photo.image;
  const scale = Math.min(164 / image.width, 204 / image.height);
  const slot = index % 9;
  const nudge = Math.min(Math.floor(index / 9), 4) * 4;
  return {
    id: crypto.randomUUID(),
    assetId: photo.asset.id,
    position: { x: 30 + (slot % 3) * 180 + nudge, y: 48 + Math.floor(slot / 3) * 235 + nudge },
    width: image.width * scale,
    height: image.height * scale,
  };
}
