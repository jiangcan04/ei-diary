interface Entry {
  readonly offset: number;
  readonly size: number;
  readonly crc: number;
}

const decoder = new TextDecoder("utf-8", { fatal: true });
const crcTable = Uint32Array.from({ length: 256 }, (_, number) => {
  for (let bit = 0; bit < 8; bit++) number = (number >>> 1) ^ (number & 1 ? 0xedb88320 : 0);
  return number;
});

function invalidZip(): never {
  throw new Error("Invalid backup ZIP.");
}

async function view(blob: Blob, offset: number, size: number): Promise<DataView<ArrayBuffer>> {
  if (offset < 0 || size < 0 || offset + size > blob.size) invalidZip();
  return new DataView(await blob.slice(offset, offset + size).arrayBuffer());
}

export async function openBackupZip(blob: Blob) {
  // The app exports ZIP32 entries using the stored method.
  if (blob.size < 22 || blob.size > 0xffffffff) invalidZip();
  const tailOffset = Math.max(0, blob.size - 65557);
  const tail = await view(blob, tailOffset, blob.size - tailOffset);
  let end = tail.byteLength - 22;
  while (end >= 0 && (tail.getUint32(end, true) !== 0x06054b50
    || end + 22 + tail.getUint16(end + 20, true) !== tail.byteLength)) end--;
  if (end < 0 || tail.getUint32(end + 4, true) !== 0) invalidZip();
  const count = tail.getUint16(end + 10, true);
  const size = tail.getUint32(end + 12, true);
  const start = tail.getUint32(end + 16, true);
  if (count !== tail.getUint16(end + 8, true) || size > 16 * 1024 * 1024
    || start + size !== tailOffset + end) invalidZip();

  const directory = await view(blob, start, size);
  const entries = new Map<string, Entry>();
  let offset = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > size || directory.getUint32(offset, true) !== 0x02014b50) invalidZip();
    const flags = directory.getUint16(offset + 8, true);
    const length = directory.getUint32(offset + 24, true);
    const nameLength = directory.getUint16(offset + 28, true);
    const nameEnd = offset + 46 + nameLength;
    const next = nameEnd + directory.getUint16(offset + 30, true) + directory.getUint16(offset + 32, true);
    if (next > size || (flags & ~0x808) !== 0 || directory.getUint16(offset + 10, true) !== 0
      || directory.getUint16(offset + 34, true) !== 0
      || length !== directory.getUint32(offset + 20, true)) invalidZip();
    const name = decoder.decode(new Uint8Array(directory.buffer, offset + 46, nameLength));
    if (entries.has(name) || !/^(manifest\.json|photos\/\d+\/\d+(?:-preview)?\.[a-z0-9]+)$/.test(name)) invalidZip();
    entries.set(name, {
      offset: directory.getUint32(offset + 42, true),
      size: length,
      crc: directory.getUint32(offset + 16, true),
    });
    offset = next;
  }
  if (offset !== size) invalidZip();

  return {
    entries: entries as ReadonlyMap<string, Entry>,
    async read(name: string, type = ""): Promise<Blob> {
      const entry = entries.get(name);
      if (!entry || entry.offset + 30 > start) invalidZip();
      const local = await view(blob, entry.offset, 30);
      const nameLength = local.getUint16(26, true);
      const data = entry.offset + 30 + nameLength + local.getUint16(28, true);
      if (local.getUint32(0, true) !== 0x04034b50 || local.getUint16(8, true) !== 0
        || (local.getUint16(6, true) & ~0x808) !== 0 || nameLength !== name.length
        || data + entry.size > start) invalidZip();
      const localName = await blob.slice(entry.offset + 30, entry.offset + 30 + nameLength).text();
      if (localName !== name) invalidZip();
      const resource = blob.slice(data, data + entry.size, type);
      let crc = 0xffffffff;
      const chunk = 256 * 1024;
      for (let offset = 0; offset < resource.size; offset += chunk) {
        const bytes = new Uint8Array(await resource.slice(offset, offset + chunk).arrayBuffer());
        for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
      }
      if (((crc ^ 0xffffffff) >>> 0) !== entry.crc) invalidZip();
      return resource;
    },
  };
}
