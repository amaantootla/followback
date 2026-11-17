/**
 * Minimal, dependency-free ZIP reader.
 *
 * Reads only the central directory and the entries you ask for, using
 * Blob.slice(), so even multi-GB Instagram exports (with photos/videos)
 * never get loaded into memory in full. Inflation uses the browser's native
 * DecompressionStream('deflate-raw').
 */

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64_LOCATOR = 0x07064b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const MAX32 = 0xffffffff;

async function readView(blob, start, end) {
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

export async function isZip(blob) {
  if (blob.size < 4) return false;
  const v = await readView(blob, 0, 4);
  return v.getUint32(0, true) === SIG_LOCAL;
}

/**
 * Returns [{ name, method, compressedSize, size, localOffset, encrypted }]
 */
export async function listZipEntries(blob) {
  // EOCD is 22 bytes + up to 65535 bytes of comment; ZIP64 locator sits 20 bytes before it.
  const tailLen = Math.min(blob.size, 22 + 65535 + 20);
  const tailStart = blob.size - tailLen;
  const tail = await readView(blob, tailStart, blob.size);

  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This file is not a valid zip archive.');

  let count = tail.getUint16(eocd + 10, true);
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);

  if (count === 0xffff || cdSize === MAX32 || cdOffset === MAX32) {
    const loc = eocd - 20;
    if (loc >= 0 && tail.getUint32(loc, true) === SIG_EOCD64_LOCATOR) {
      const z64Offset = Number(tail.getBigUint64(loc + 8, true));
      const z64 = await readView(blob, z64Offset, z64Offset + 56);
      if (z64.getUint32(0, true) !== SIG_EOCD64) throw new Error('Corrupt ZIP64 archive.');
      count = Number(z64.getBigUint64(32, true));
      cdSize = Number(z64.getBigUint64(40, true));
      cdOffset = Number(z64.getBigUint64(48, true));
    }
  }

  const cd = await readView(blob, cdOffset, cdOffset + cdSize);
  const decoder = new TextDecoder('utf-8');
  const entries = [];
  let p = 0;

  for (let i = 0; i < count && p + 46 <= cd.byteLength; i++) {
    if (cd.getUint32(p, true) !== SIG_CENTRAL) break;
    const flags = cd.getUint16(p + 8, true);
    const method = cd.getUint16(p + 10, true);
    let compressedSize = cd.getUint32(p + 20, true);
    let size = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    let localOffset = cd.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));

    if (size === MAX32 || compressedSize === MAX32 || localOffset === MAX32) {
      let e = p + 46 + nameLen;
      const end = e + extraLen;
      while (e + 4 <= end) {
        const id = cd.getUint16(e, true);
        const len = cd.getUint16(e + 2, true);
        if (id === 0x0001) {
          let q = e + 4;
          if (size === MAX32) { size = Number(cd.getBigUint64(q, true)); q += 8; }
          if (compressedSize === MAX32) { compressedSize = Number(cd.getBigUint64(q, true)); q += 8; }
          if (localOffset === MAX32) { localOffset = Number(cd.getBigUint64(q, true)); }
          break;
        }
        e += 4 + len;
      }
    }

    if (!name.endsWith('/')) {
      entries.push({ name, method, compressedSize, size, localOffset, encrypted: (flags & 1) === 1 });
    }
    p += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

export async function readZipEntryText(blob, entry) {
  if (entry.encrypted) throw new Error(`${entry.name} is password-protected.`);
  const lh = await readView(blob, entry.localOffset, entry.localOffset + 30);
  if (lh.getUint32(0, true) !== SIG_LOCAL) throw new Error(`Corrupt zip entry: ${entry.name}`);
  const dataStart = entry.localOffset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
  const data = blob.slice(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) return data.text();
  if (entry.method === 8) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Your browser can’t unzip files. Unzip the export and drop the folder instead.');
    }
    const stream = data.stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  }
  throw new Error(`Unsupported compression in ${entry.name}. Unzip the export and drop the folder instead.`);
}
