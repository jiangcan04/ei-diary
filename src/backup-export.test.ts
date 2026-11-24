import { unzipSync } from "fflate";
import { expect, test } from "vitest";
import { exportBackup, type BackupManifest } from "./backup-export";
import { readBackup } from "./backup-import";
import type { DiaryPage } from "./diary-page";

const page: DiaryPage = {
  id: "page-1",
  recordDate: "2026-11-18",
  createdAt: 100,
  strokes: [{ points: [{ x: 23, y: 56 }], color: "#252322", width: 4 }],
  photos: [{ id: "placement", assetId: "asset", position: { x: 10, y: 20 }, width: 80, height: 90 }],
};

test("keeps the complete photo bytes across ZIP chunks and preserves the editable page", async () => {
  const bytes = Uint8Array.from({ length: 550_000 }, (_, index) => index % 251);
  const original = new Blob([bytes], { type: "image/png" });
  const backup = await exportBackup([{ page, photos: [{ id: "asset", original }] }]);
  const entries = unzipSync(new Uint8Array(await backup.arrayBuffer()));
  const manifest = JSON.parse(new TextDecoder().decode(entries["manifest.json"])) as BackupManifest;
  expect(manifest.version).toBe(1);
  expect(manifest.pages[0].page).toEqual(page);
  const [{ original: resource }] = manifest.pages[0].photos;
  expect(resource.type).toBe("image/png");
  expect(resource.size).toBe(bytes.byteLength);
  expect(entries[resource.path]).toEqual(bytes);
  const restored = await readBackup(backup);
  expect(restored[0].page).toEqual(page);
  expect(new Uint8Array(await restored[0].photos[0].original.arrayBuffer())).toEqual(bytes);
  const damaged = new Uint8Array(await backup.arrayBuffer());
  damaged[30 + "manifest.json".length] ^= 1;
  await expect(readBackup(new Blob([damaged]))).rejects.toThrow("Invalid backup ZIP");
});

test("rejects a broken photo reference instead of producing an incomplete backup", async () => {
  await expect(exportBackup([{ page, photos: [] }])).rejects.toThrow("missing photo");
});
