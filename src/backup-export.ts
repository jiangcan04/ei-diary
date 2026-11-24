import { Zip, ZipPassThrough } from "fflate";
import type { StoredDiaryPage } from "./diary-store";
import type { DiaryPage } from "./diary-page";

interface BackupResource {
  readonly path: string;
  readonly type: string;
  readonly size: number;
}

interface BackupPhoto {
  readonly id: string;
  readonly original: BackupResource;
  readonly preview?: BackupResource;
}

export interface BackupManifest {
  readonly format: "ei-ni-kan-backup";
  readonly version: 1;
  readonly pages: readonly { page: DiaryPage; photos: readonly BackupPhoto[] }[];
}

const chunkSize = 256 * 1024;
const fileExtensions: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif",
  "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
};

export async function exportBackup(snapshot: readonly StoredDiaryPage[]): Promise<Blob> {
  const files: { path: string; blob: Blob }[] = [];
  function addResource(stem: string, blob: Blob): BackupResource {
    const extension = fileExtensions[blob.type] ?? "bin";
    const path = `${stem}.${extension}`;
    files.push({ path, blob });
    return { path, type: blob.type, size: blob.size };
  }

  const manifest: BackupManifest = {
    format: "ei-ni-kan-backup",
    version: 1,
    pages: snapshot.map(({ page, photos }, pageIndex) => {
      const assets = new Map(photos.map((asset) => [asset.id, asset]));
      const ids = new Set(page.photos.map(({ assetId }) => assetId));
      const resources = Array.from(ids, (id, photoIndex) => {
        const asset = assets.get(id);
        if (!asset) throw new Error("A backup page references a missing photo.");
        const stem = `photos/${pageIndex}/${photoIndex}`;
        return {
          id,
          original: addResource(stem, asset.original),
          preview: asset.preview && addResource(`${stem}-preview`, asset.preview),
        };
      });
      return { page, photos: resources };
    }),
  };
  const manifestFile = { path: "manifest.json", blob: new Blob([JSON.stringify(manifest)]) };
  const entries = [manifestFile, ...files];
  const size = entries.reduce((total, { path, blob }) => total + blob.size + 128 + path.length * 2, 22);
  if (entries.length > 65535 || size > 0xffffffff) throw new Error("Backup exceeds ZIP limits.");

  const pieces: Blob[] = [];
  const zip = new Zip((error, data) => {
    if (error) throw error;
    pieces.push(new Blob([new Uint8Array(data)]));
  });
  for (const { path, blob } of entries) {
    const entry = new ZipPassThrough(path);
    zip.add(entry);
    if (!blob.size) entry.push(new Uint8Array(), true);
    for (let offset = 0; offset < blob.size; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, blob.size);
      const bytes = new Uint8Array(await blob.slice(offset, end).arrayBuffer());
      entry.push(bytes, end === blob.size);
    }
  }
  zip.end();
  return new Blob(pieces, { type: "application/zip" });
}
