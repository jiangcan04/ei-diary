import { openBackupZip } from "./backup-zip";
import type { DiaryPage } from "./diary-page";
import type { PhotoAsset, StoredDiaryPage } from "./diary-store";

function check(value: unknown): asserts value {
  if (!value) throw new Error("Invalid backup manifest or resource reference.");
}

function object(value: unknown): Record<string, unknown> {
  check(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function identifier(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 256;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function point(value: unknown): void {
  const { x, y } = object(value);
  check(finite(x) && finite(y));
}

function parsePage(value: unknown): DiaryPage {
  const page = object(value);
  check(identifier(page.id) && typeof page.recordDate === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(page.recordDate)
    && typeof page.createdAt === "number" && Number.isSafeInteger(page.createdAt)
    && Array.isArray(page.strokes) && Array.isArray(page.photos));
  const day = new Date(`${page.recordDate}T00:00:00Z`);
  check(Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === page.recordDate);
  for (const raw of page.strokes) {
    const { points, color, width } = object(raw);
    check(Array.isArray(points) && points.length > 0
      && typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) && finite(width) && width > 0);
    for (const coordinate of points) point(coordinate);
  }
  const placementIds = new Set<string>();
  for (const raw of page.photos) {
    const { id, assetId, position, width, height } = object(raw);
    check(identifier(id) && identifier(assetId) && !placementIds.has(id)
      && finite(width) && width > 0 && finite(height) && height > 0);
    point(position);
    placementIds.add(id);
  }
  return value as DiaryPage;
}

export async function readBackup(file: Blob): Promise<readonly StoredDiaryPage[]> {
  const archive = await openBackupZip(file);
  const manifestEntry = archive.entries.get("manifest.json");
  check(manifestEntry && manifestEntry.size <= 32 * 1024 * 1024);
  const manifestFile = await archive.read("manifest.json");
  const manifest = object(JSON.parse(await manifestFile.text()));
  check(manifest.format === "ei-ni-kan-backup" && manifest.version === 1 && Array.isArray(manifest.pages));

  const usedPaths = new Set(["manifest.json"]);
  const seenPages = new Set<string>();
  const pages: StoredDiaryPage[] = [];

  async function readResource(value: unknown): Promise<Blob> {
    const { path, type, size } = object(value);
    check(typeof path === "string" && !usedPaths.has(path)
      && typeof type === "string" && /^[ -~]{0,128}$/.test(type)
      && typeof size === "number" && Number.isSafeInteger(size) && size > 0
      && archive.entries.get(path)?.size === size);
    usedPaths.add(path);
    return archive.read(path, type);
  }

  for (const raw of manifest.pages) {
    const entry = object(raw);
    const page = parsePage(entry.page);
    check(!seenPages.has(page.id) && Array.isArray(entry.photos));
    seenPages.add(page.id);
    const remaining = new Set(page.photos.map(({ assetId }) => assetId));
    const photos: PhotoAsset[] = [];
    for (const rawPhoto of entry.photos) {
      const { id, original, preview } = object(rawPhoto);
      check(identifier(id) && remaining.delete(id));
      photos.push({
        id,
        original: await readResource(original),
        preview: preview === undefined ? undefined : await readResource(preview),
      });
    }
    check(remaining.size === 0);
    pages.push({ page, photos });
  }
  check(usedPaths.size === archive.entries.size);
  return pages;
}
