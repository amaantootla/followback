/**
 * Takes whatever the user drops — a zip (or several split zips), a folder,
 * or loose JSON/HTML files — and finds the followers / following data in it.
 */

import { isZip, listZipEntries, readZipEntryText } from './zip.js';
import {
  parseFollowers, parseFollowing, parsePending, parseHtmlProfiles, parseConnections, detectJsonKind,
} from './parser.js';

const NAME_RULES = [
  [/^followers(_\d+)?\.(json|html?)$/i, 'followers'],
  [/^following\.(json|html?)$/i, 'following'],
  [/^pending_follow_requests\.(json|html?)$/i, 'pending'],
  [/^connections\.json$/i, 'connections'],
];

const MAX_SNIFF_BYTES = 50 * 1024 * 1024;

function basename(path) {
  return path.split('/').pop();
}

function isJunk(path) {
  return path.startsWith('__MACOSX/') || path.includes('/__MACOSX/') || basename(path).startsWith('._');
}

export function kindFromName(path) {
  const name = basename(path);
  for (const [re, kind] of NAME_RULES) if (re.test(name)) return kind;
  return null;
}

function isTextExport(path) {
  return /\.(json|html?)$/i.test(path);
}

/**
 * Parses one file's text. `nameKind` is what the filename suggests (may be null).
 * Returns [{ kind, map, guessed }] — usually one item, three for connections.json.
 */
export function parseExportText(path, text, nameKind) {
  if (/\.html?$/i.test(path)) {
    let kind = nameKind;
    if (!kind) {
      const title = (text.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
      if (/^\s*followers\b/i.test(title)) kind = 'followers';
      else if (/^\s*following\s*$/i.test(title)) kind = 'following';
    }
    if (!kind || kind === 'connections') return [];
    return [{ kind, map: parseHtmlProfiles(text), guessed: !nameKind }];
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    if (nameKind) throw new Error(`${basename(path)} isn’t valid JSON.`);
    return [];
  }

  const contentKind = detectJsonKind(json);
  let kind = null;
  if (contentKind === 'connections' || nameKind === 'connections') {
    const c = parseConnections(json);
    return [
      { kind: 'followers', map: c.followers, guessed: false },
      { kind: 'following', map: c.following, guessed: false },
      { kind: 'pending', map: c.pending, guessed: false },
    ].filter(r => r.map.size > 0);
  }
  // Content wins over a filename when the content is explicit.
  if (contentKind && contentKind !== 'array') kind = contentKind;
  else if (nameKind) kind = nameKind;
  else if (contentKind === 'array') kind = 'followers'; // followers_N.json is the only bare-array file

  if (!kind) return [];
  const parse = kind === 'followers' ? parseFollowers : kind === 'following' ? parseFollowing : parsePending;
  return [{ kind, map: parse(json), guessed: !nameKind && contentKind === 'array' }];
}

/**
 * Turns a drop event's DataTransfer into a flat list of { path, file },
 * descending into dropped folders. Must be called synchronously in the
 * drop handler (DataTransferItems die after the first await).
 */
export function filesFromDataTransfer(dt) {
  const entries = [];
  if (dt.items && dt.items.length && typeof dt.items[0].webkitGetAsEntry === 'function') {
    for (const item of dt.items) {
      if (item.kind !== 'file') continue;
      const entry = item.webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
  }
  if (!entries.length) {
    return Promise.resolve(Array.from(dt.files || []).map(file => ({ path: file.name, file })));
  }
  return Promise.all(entries.map(e => walkEntry(e, ''))).then(lists => lists.flat());
}

async function walkEntry(entry, prefix) {
  const path = prefix + entry.name;
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    return [{ path, file }];
  }
  if (!entry.isDirectory) return [];
  const reader = entry.createReader();
  const children = [];
  // readEntries returns results in batches; keep going until it returns none.
  for (;;) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) break;
    children.push(...batch);
  }
  const nested = await Promise.all(children.map(c => walkEntry(c, path + '/')));
  return nested.flat();
}

export function filesFromInput(fileList) {
  return Array.from(fileList).map(file => ({ path: file.webkitRelativePath || file.name, file }));
}

/**
 * Main entry point. Returns:
 * {
 *   followers: Map | null, following: Map | null, pending: Map | null,
 *   sources: [{ path, kind, count, guessed }],
 *   errors: [string],
 * }
 * A kind is null when nothing for it was found in this batch.
 */
export async function importFiles(items, onProgress = () => {}) {
  const result = { followers: null, following: null, pending: null, sources: [], errors: [] };

  const add = (path, parsed) => {
    for (const { kind, map, guessed } of parsed) {
      if (!result[kind]) result[kind] = new Map();
      for (const [u, ts] of map) if (!result[kind].has(u)) result[kind].set(u, ts);
      result.sources.push({ path, kind, count: map.size, guessed });
    }
  };

  for (const { path, file } of items) {
    if (isJunk(path)) continue;
    const loose = !path.includes('/');
    try {
      if (/\.zip$/i.test(path) || (loose && !isTextExport(path) && await isZip(file))) {
        onProgress(`Opening ${basename(path)}…`);
        await importZip(file, path, add);
      } else if (isTextExport(path)) {
        const nameKind = kindFromName(path);
        // Loose files dropped by hand: try anything. Inside folders: only plausible names.
        if (!nameKind && (!loose || file.size > MAX_SNIFF_BYTES)) continue;
        onProgress(`Reading ${basename(path)}…`);
        add(path, parseExportText(path, await file.text(), nameKind));
      }
    } catch (err) {
      result.errors.push(err.message || String(err));
    }
  }

  return result;
}

async function importZip(blob, zipPath, add) {
  const entries = await listZipEntries(blob);
  let candidates = entries.filter(e => !isJunk(e.name) && kindFromName(e.name));

  // Renamed files: fall back to sniffing small JSON files that mention "follow".
  if (!candidates.length) {
    candidates = entries.filter(e =>
      !isJunk(e.name) && /follow/i.test(e.name) && /\.(json|html?)$/i.test(e.name) && e.size < MAX_SNIFF_BYTES);
  }

  const zipName = basename(zipPath);
  for (const entry of candidates) {
    const text = await readZipEntryText(blob, entry);
    add(`${zipName} › ${entry.name}`, parseExportText(entry.name, text, kindFromName(entry.name)));
  }
}
