import { describe, expect, test } from "vitest";
import { changeDiaryDate, createDiaryPage, toViewportPoint } from "./diary-page";

describe("diary pages", () => {
  test("gives same-day pages separate IDs and preserves a cross-day page", () => {
    const time = new Date(2026, 10, 18, 9);
    const pages = [
      createDiaryPage(time),
      createDiaryPage(time),
      createDiaryPage(new Date(2026, 10, 19, 9)),
    ];

    expect(new Set(pages.map((page) => page.id)).size).toBe(3);
    expect(pages.map((page) => page.recordDate)).toEqual([
      "2026-11-18", "2026-11-18", "2026-11-19",
    ]);
  });

  test("backdates a page without changing its identity, creation time or content", () => {
    const time = new Date(2026, 10, 18, 9);
    const page = createDiaryPage(time, "2026-11-10");
    const changed = changeDiaryDate(page, "2026-11-09");

    expect(page.recordDate).toBe("2026-11-10");
    expect(changed.recordDate).toBe("2026-11-09");
    expect(changed.id).toBe(page.id);
    expect(changed.createdAt).toBe(time.getTime());
    expect(changed.strokes).toBe(page.strokes);
    expect(changed.photos).toBe(page.photos);
  });

  test("switches the default date at 02:00 without redating a page during editing", () => {
    const before = createDiaryPage(new Date(2026, 0, 1, 1, 59));
    const after = createDiaryPage(new Date(2026, 0, 1, 2));
    const edited = {
      ...before,
      strokes: [{ points: [{ x: 9, y: 10 }], color: "#252322", width: 2 }],
    };

    expect(after.recordDate).toBe("2026-01-01");
    expect(edited.recordDate).toBe("2025-12-31");
  });

  test("projects photos and strokes without modifying their paper coordinates", () => {
    const stroke = { points: [{ x: 2, y: 3 }], color: "#252322", width: 2 };
    const photo = {
      id: "placement-1",
      assetId: "photo-1",
      position: { x: 20, y: 30 },
      width: 40,
      height: 50,
    };
    const page = { ...createDiaryPage(), strokes: [stroke], photos: [photo] };
    const snapshot = structuredClone(page);
    const offset = { x: 5, y: -3 };

    expect(toViewportPoint(page.strokes[0].points[0], 2, offset)).toEqual({ x: 9, y: 3 });
    expect(toViewportPoint(page.photos[0].position, 2, offset)).toEqual({ x: 45, y: 57 });
    expect(page).toEqual(snapshot);
  });
});
