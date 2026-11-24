import type { PaperPoint, PhotoPlacement } from "./diary-page";
import { paperSize, type VisiblePaper } from "./paper-viewport";

export function photoAt(photos: readonly PhotoPlacement[], point: PaperPoint): PhotoPlacement | undefined {
  for (let index = photos.length - 1; index >= 0; index--) {
    const photo = photos[index];
    const { x, y } = photo.position;
    if (point.x >= x && point.x <= x + photo.width &&
        point.y >= y && point.y <= y + photo.height) return photo;
  }
  return undefined;
}

export function movePhoto(photo: PhotoPlacement, position: PaperPoint): PhotoPlacement {
  return {
    ...photo,
    position: {
      x: Math.max(0, Math.min(paperSize.width - photo.width, position.x)),
      y: Math.max(0, Math.min(paperSize.height - photo.height, position.y)),
    },
  };
}

export function scalePhoto(photo: PhotoPlacement, factor: number): PhotoPlacement {
  const max = Math.min(paperSize.width / photo.width, paperSize.height / photo.height);
  const min = Math.min(1, 36 / Math.max(photo.width, photo.height));
  const ratio = Math.min(max, Math.max(min, factor));
  const width = photo.width * ratio;
  const height = photo.height * ratio;
  return movePhoto({ ...photo, width, height }, {
    x: photo.position.x + (photo.width - width) / 2,
    y: photo.position.y + (photo.height - height) / 2,
  });
}

export function centerPhotoInView(
  photo: PhotoPlacement, image: { width: number; height: number }, view: VisiblePaper,
): PhotoPlacement {
  const scale = Math.min(view.width * 0.5 / image.width, view.height * 0.5 / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return movePhoto({ ...photo, width, height }, {
    x: view.x + (view.width - width) / 2,
    y: view.y + (view.height - height) / 2,
  });
}

export function arrangePhotosInView(
  photos: readonly PhotoPlacement[],
  images: readonly { width: number; height: number }[],
  view: VisiblePaper,
): PhotoPlacement[] {
  if (photos.length === 1) return [centerPhotoInView(photos[0], images[0], view)];
  if (photos.length === 2) {
    return photos.map((photo, index) => {
      const image = images[index];
      const scale = Math.min(view.width * 0.4 / image.width, view.height * 0.45 / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      return movePhoto({ ...photo, width, height }, {
        x: view.x + view.width * (index === 0 ? 0.08 : 0.52),
        y: view.y + (view.height - height) / 2,
      });
    });
  }

  const columns = photos.length === 3 ? 3 : Math.ceil(Math.sqrt(photos.length));
  const rows = Math.ceil(photos.length / columns);
  const stepX = view.width * 0.9 / columns;
  const stepY = view.height * 0.5 / Math.max(rows, 2);
  return photos.map((photo, index) => {
    const image = images[index];
    const scale = Math.min(stepX * 0.92 / image.width, stepY * 0.82 / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const usedRows = Math.ceil(photos.length / columns);
    return movePhoto({ ...photo, width, height }, {
      x: view.x + view.width * 0.05 + (index % columns) * stepX,
      y: view.y + (view.height - ((usedRows - 1) * stepY + height)) / 2
        + Math.floor(index / columns) * stepY,
    });
  });
}
