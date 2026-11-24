import Dexie, { type Table } from "dexie";
import type { DiaryDate, DiaryPage } from "./diary-page";

export interface PhotoAsset {
  readonly id: string;
  readonly original: Blob;
  readonly preview?: Blob;
}

interface StoredPhoto extends PhotoAsset {
  readonly pageId: string;
}

interface StoredThumbnail {
  readonly pageId: string;
  readonly image: Blob;
}

export interface StoredDiaryPage {
  readonly page: DiaryPage;
  readonly photos: readonly PhotoAsset[];
  readonly thumbnail?: Blob;
}

export interface CalendarDay {
  readonly page: DiaryPage;
  readonly count: number;
  readonly thumbnail?: Blob;
}

export interface ReadingDay {
  readonly pages: readonly DiaryPage[];
  readonly older?: DiaryPage;
  readonly newer?: DiaryPage;
}

export class DiaryStore {
  private readonly db: Dexie;
  private readonly pages: Table<DiaryPage, string>;
  private readonly photos: Table<StoredPhoto, [string, string]>;
  private readonly thumbnails: Table<StoredThumbnail, string>;

  constructor(databaseName = "ei-ni-kan") {
    this.db = new Dexie(databaseName);
    this.db.version(1).stores({
      pages: "id, [recordDate+createdAt]",
      photos: "[pageId+id], pageId",
    });
    this.db.version(2).stores({ thumbnails: "pageId" });

    this.pages = this.db.table("pages");
    this.photos = this.db.table("photos");
    this.thumbnails = this.db.table("thumbnails");
  }

  async savePage(
    page: DiaryPage,
    newPhotos: readonly PhotoAsset[] = [],
    thumbnail?: Blob,
  ): Promise<void> {
    const assetIds = new Set(page.photos.map((placement) => placement.assetId));

    await this.db.transaction("rw", this.pages, this.photos, this.thumbnails, async () => {
      await this.photos.bulkPut(
        newPhotos.filter((photo) => assetIds.has(photo.id))
          .map((photo) => ({ ...photo, pageId: page.id })),
      );

      const storedPhotos = this.photos.where("pageId").equals(page.id);
      const storedIds = new Set((await storedPhotos.primaryKeys()).map(([, id]) => id));
      for (const id of assetIds) {
        if (!storedIds.has(id)) {
          throw new Error(`Missing photo asset "${id}" for page "${page.id}".`);
        }
      }

      await storedPhotos.filter((photo) => !assetIds.has(photo.id)).delete();
      await this.pages.put(page);
      // The previous thumbnail might no longer represent this page.
      if (thumbnail) {
        await this.thumbnails.put({ pageId: page.id, image: thumbnail });
      } else {
        await this.thumbnails.delete(page.id);
      }
    });
  }

  async getLatestPageForDate(date: DiaryDate): Promise<{
    page: DiaryPage;
    thumbnail?: Blob;
  } | undefined> {
    return this.db.transaction("r", this.pages, this.thumbnails, async () => {
      const page = await this.pages.where("[recordDate+createdAt]")
        .between([date, Dexie.minKey], [date, Dexie.maxKey], true, true)
        .last();
      if (!page) return undefined;
      return { page, thumbnail: (await this.thumbnails.get(page.id))?.image };
    });
  }

  async getCalendarDays(first: DiaryDate, last: DiaryDate): Promise<CalendarDay[]> {
    return this.db.transaction("r", this.pages, this.thumbnails, async () => {
      const days = new Map<DiaryDate, CalendarDay>();
      await this.pages.where("[recordDate+createdAt]")
        .between([first, Dexie.minKey], [last, Dexie.maxKey], true, true)
        .each((page) => {
          const count = (days.get(page.recordDate)?.count ?? 0) + 1;
          days.set(page.recordDate, { page, count });
        });
      const entries = [...days.values()];
      const thumbnails = await this.thumbnails.bulkGet(entries.map(({ page }) => page.id));
      return entries.map((entry, index) => ({ ...entry, thumbnail: thumbnails[index]?.image }));
    });
  }

  async getReadingDay(date: DiaryDate): Promise<ReadingDay> {
    return this.db.transaction("r", this.pages, async () => {
      const index = this.pages.where("[recordDate+createdAt]");
      const start = [date, Dexie.minKey];
      const end = [date, Dexie.maxKey];
      const pages = await index.between(start, end, true, true).toArray();
      const older = await index.below(start).last();
      const newer = await index.above(end).first();
      return { pages, older, newer };
    });
  }

  async getPage(id: string): Promise<StoredDiaryPage | undefined> {
    return this.db.transaction("r", this.pages, this.photos, this.thumbnails, async () => {
      const page = await this.pages.get(id);
      if (!page) return undefined;

      const photos = (await this.photos.where("pageId").equals(id).toArray())
        .map(({ id, original, preview }) => preview ? { id, original, preview } : { id, original });
      const thumbnail = await this.thumbnails.get(id);
      return { page, photos, thumbnail: thumbnail?.image };
    });
  }

  async getBackupSnapshot(): Promise<readonly StoredDiaryPage[]> {
    return this.db.transaction("r", this.pages, this.photos, async () => {
      const pages = await this.pages.toArray();
      const photosByPage = new Map<string, PhotoAsset[]>();
      await this.photos.each(({ pageId, id, original, preview }) => {
        const asset = { id, original, preview };
        const photos = photosByPage.get(pageId);
        if (photos) photos.push(asset);
        else photosByPage.set(pageId, [asset]);
      });
      return pages.map((page) => ({ page, photos: photosByPage.get(page.id) ?? [] }));
    });
  }

  async restoreBackup(snapshot: readonly StoredDiaryPage[]): Promise<number> {
    return this.db.transaction("rw", this.pages, this.photos, async () => {
      let added = 0;
      for (const { page, photos } of snapshot) {
        if (await this.pages.get(page.id)) continue;
        await this.pages.add(page);
        await this.photos.bulkAdd(photos.map((asset) => ({ ...asset, pageId: page.id })));
        added++;
      }
      return added;
    });
  }

  async deletePage(id: string): Promise<void> {
    await this.db.transaction("rw", this.pages, this.photos, this.thumbnails, async () => {
      await this.pages.delete(id);
      await this.photos.where("pageId").equals(id).delete();
      await this.thumbnails.delete(id);
    });
  }

  close(): void {
    this.db.close();
  }
}
