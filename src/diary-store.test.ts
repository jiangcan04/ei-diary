import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDiaryPage } from "./diary-page";
import { DiaryStore } from "./diary-store";

function makePage() {
  return {
    ...createDiaryPage(new Date(2026, 10, 18, 12)),
    strokes: [{ points: [{ x: 4, y: 5 }], color: "#252322", width: 2 }],
    photos: [{
      id: "placement",
      assetId: "photo",
      position: { x: 8, y: 16 },
      width: 100,
      height: 150,
    }],
  };
}

describe("local diary storage", () => {
  let databaseName: string;
  let store: DiaryStore;

  beforeEach(() => {
    databaseName = `diary-store-test-${crypto.randomUUID()}`;
    store = new DiaryStore(databaseName);
  });

  afterEach(async () => {
    store.close();
    await Dexie.delete(databaseName);
  });

  test("rolls back all additions if a later restore write fails", async () => {
    const local = createDiaryPage();
    await store.savePage(local);
    const first = createDiaryPage();
    const later = makePage();
    const photo = { id: "photo", original: new Blob(["photo"]) };
    await expect(store.restoreBackup([
      { page: first, photos: [] },
      { page: later, photos: [photo, photo] },
    ])).rejects.toThrow();
    expect((await store.getBackupSnapshot()).map(({ page }) => page)).toEqual([local]);
  });

  test("finds reading neighbors across an empty date", async () => {
    const old = createDiaryPage(new Date(2026, 10, 16, 12));
    const first = createDiaryPage(new Date(2026, 10, 18, 12));
    const last = createDiaryPage(new Date(2026, 10, 18, 13));
    for (const page of [last, old, first]) await store.savePage(page);
    expect(await store.getReadingDay("2026-11-16")).toEqual({
      pages: [old], older: undefined, newer: first,
    });
    expect(await store.getReadingDay("2026-11-18")).toEqual({
      pages: [first, last], older: old, newer: undefined,
    });
  });

  test("reopens a page with strokes, photo bytes, preview and thumbnail", async () => {
    const page = makePage();
    const original = new Blob([new Uint8Array([255, 216, 255])], { type: "image/jpeg" });
    const preview = new Blob(["preview"], { type: "image/jpeg" });
    await store.savePage(page, [{ id: "photo", original, preview }], new Blob(["thumbnail"]));
    store.close();
    store = new DiaryStore(databaseName);

    const saved = await store.getPage(page.id);
    expect(saved?.page).toEqual(page);
    expect(saved?.photos.map((photo) => photo.id)).toEqual(["photo"]);
    expect(saved?.photos[0].original.type).toBe("image/jpeg");
    expect(new Uint8Array(await saved!.photos[0].original.arrayBuffer())).toEqual(
      new Uint8Array([255, 216, 255]),
    );
    expect(await saved?.photos[0].preview?.text()).toBe("preview");
    expect(await saved?.thumbnail?.text()).toBe("thumbnail");
  });

  test("rolls back a cross-table save when a photo reference is missing", async () => {
    const page = makePage();
    await store.savePage(page, [{ id: "photo", original: new Blob(["before"]) }],
      new Blob(["before thumbnail"]));

    const invalidPage = {
      ...page,
      strokes: [],
      photos: [...page.photos, { ...page.photos[0], id: "missing", assetId: "missing" }],
    };
    await expect(store.savePage(
      invalidPage,
      [{ id: "photo", original: new Blob(["after"]) }],
    )).rejects.toThrow("Missing photo asset");

    store.close();
    store = new DiaryStore(databaseName);
    const saved = await store.getPage(page.id);
    expect(saved?.page).toEqual(page);
    expect(await saved?.photos[0].original.text()).toBe("before");
    expect(await saved?.thumbnail?.text()).toBe("before thumbnail");
  });

  test("removes saved photo resources and thumbnails when no longer used", async () => {
    const page = makePage();
    const photo = { id: "photo", original: new Blob(["photo"]) };
    await store.savePage(page, [photo], new Blob(["thumbnail"]));
    await store.savePage({ ...page, photos: [] });
    expect(await store.getPage(page.id)).toEqual({
      page: { ...page, photos: [] }, photos: [], thumbnail: undefined,
    });
    await expect(store.savePage(page)).rejects.toThrow("Missing photo asset");
    await store.savePage(page, [photo], new Blob(["new thumbnail"]));
    await store.deletePage(page.id);
    expect(await store.getPage(page.id)).toBeUndefined();
    await expect(store.savePage(page)).rejects.toThrow("Missing photo asset");
    await store.savePage({ ...page, photos: [] });
    expect((await store.getPage(page.id))?.thumbnail).toBeUndefined();
  });

  test("opens version-one data after the thumbnail table is added", async () => {
    const page = makePage();
    const oldDb = new Dexie(databaseName);
    oldDb.version(1).stores({
      pages: "id, [recordDate+createdAt]",
      photos: "[pageId+id], pageId",
    });
    try {
      await oldDb.table("pages").add(page);
      await oldDb.table("photos").add({
        pageId: page.id, id: "photo", original: new Blob(["legacy photo"]),
      });
    } finally {
      oldDb.close();
    }

    const saved = await store.getPage(page.id);
    expect(saved?.page).toEqual(page);
    expect(await saved?.photos[0].original.text()).toBe("legacy photo");
    expect(saved?.thumbnail).toBeUndefined();
    await store.savePage(page, [], new Blob(["new thumbnail"]));
    expect(await (await store.getPage(page.id))?.thumbnail?.text()).toBe("new thumbnail");
  });
});
