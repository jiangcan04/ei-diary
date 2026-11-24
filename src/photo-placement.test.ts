import { expect, test } from "vitest";
import { arrangePhotosInView, centerPhotoInView } from "./photo-placement";
import { visiblePaper } from "./paper-viewport";

test("centers landscape and portrait photos inside a zoomed paper edge", () => {
  const view = visiblePaper({ scale: 4, offset: { x: -1800, y: -2400 } });
  const photo = { id: "photo", assetId: "asset", position: { x: 0, y: 0 }, width: 100, height: 100 };
  for (const image of [{ width: 1600, height: 900 }, { width: 900, height: 1600 }]) {
    const next = centerPhotoInView(photo, image, view);
    expect(next.position.x + next.width / 2).toBeCloseTo(view.x + view.width / 2);
    expect(next.position.y + next.height / 2).toBeCloseTo(view.y + view.height / 2);
    expect(next.width).toBeLessThanOrEqual(view.width / 2);
    expect(next.height).toBeLessThanOrEqual(view.height / 2);
    expect(next.width / next.height).toBeCloseTo(image.width / image.height);
    expect(next.position.x).toBeGreaterThanOrEqual(view.x);
    expect(next.position.y).toBeGreaterThanOrEqual(view.y);
    expect(next.position.x + next.width).toBeLessThanOrEqual(600);
    expect(next.position.y + next.height).toBeLessThanOrEqual(800);
  }
});

test("every batch placement remains visible and keeps its image ratio", () => {
  const view = visiblePaper({ scale: 2, offset: { x: -250, y: -500 } });
  for (const count of [2, 3, 5, 12]) {
    const photos = Array.from({ length: count }, (_, index) => ({
      id: String(index), assetId: String(index), position: { x: 0, y: 0 }, width: 100, height: 100,
    }));
    const images = photos.map((_, index) => index % 2
      ? { width: 900, height: 1600 } : { width: 1600, height: 900 });
    const placed = arrangePhotosInView(photos, images, view);
    expect(photos.every((photo) => photo.position.x === 0 && photo.position.y === 0)).toBe(true);
    for (const [index, photo] of placed.entries()) {
      expect(photo.position.x).toBeGreaterThanOrEqual(view.x);
      expect(photo.position.y).toBeGreaterThanOrEqual(view.y);
      expect(photo.position.x + photo.width).toBeLessThanOrEqual(view.x + view.width);
      expect(photo.position.y + photo.height).toBeLessThanOrEqual(view.y + view.height);
      expect(photo.width / photo.height).toBeCloseTo(images[index].width / images[index].height);
    }
    expect(new Set(placed.map(({ position }) => position.x + ":" + position.y)).size).toBe(count);
  }
});
