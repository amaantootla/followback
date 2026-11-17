/**
 * Instagram export parsing.
 *
 * Every parse function returns a Map<username, timestampSeconds | null>.
 * Maps expose .has()/.size/.keys() just like Sets, so callers that only need
 * membership can treat them as sets.
 */

const USERNAME_RE = /^[a-z0-9._]{1,30}$/;
const NON_PROFILE_PATHS = new Set([
  'accounts', 'explore', 'p', 'reel', 'reels', 'stories', 'direct', 'about', 'legal', 'developer', 'web', 'tv',
]);

export function normalizeUsername(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let name = raw.trim().toLowerCase();

  if (name.includes('instagram.com/')) {
    const match = name.match(/instagram\.com\/(?:_u\/)?([^/?#\s]+)/);
    if (!match) return null;
    name = match[1];
    if (NON_PROFILE_PATHS.has(name)) return null;
  }

  if (name.startsWith('@')) name = name.slice(1);
  name = name.replace(/\/+$/, '').trim();

  return USERNAME_RE.test(name) ? name : null;
}

function extractRecord(item) {
  if (!item) return null;
  if (typeof item === 'string') return { username: normalizeUsername(item), ts: null };

  let username = null;
  let ts = null;
  const sld = Array.isArray(item.string_list_data) ? item.string_list_data[0] : null;

  if (sld) {
    if (typeof sld.timestamp === 'number') ts = sld.timestamp;
    username = normalizeUsername(sld.value) || normalizeUsername(sld.href);
  }
  if (!username) username = normalizeUsername(item.title);
  if (!username) username = normalizeUsername(item.username) || normalizeUsername(item.value) || normalizeUsername(item.href);
  if (ts === null && typeof item.timestamp === 'number') ts = item.timestamp;

  return username ? { username, ts } : null;
}

function recordsToMap(items) {
  const out = new Map();
  for (const item of items) {
    const rec = extractRecord(item);
    if (rec && rec.username && !out.has(rec.username)) out.set(rec.username, rec.ts);
  }
  return out;
}

/** Old (pre-2021) exports: { "followers": { "user": "2019-01-01T..." } } */
function objectMapToMap(obj) {
  const out = new Map();
  for (const [key, value] of Object.entries(obj)) {
    const username = normalizeUsername(key);
    if (!username) continue;
    const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
    out.set(username, Number.isNaN(parsed) ? null : Math.floor(parsed / 1000));
  }
  return out;
}

function pickArray(json, preferredKeys) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== 'object') return [];
  for (const key of preferredKeys) {
    if (Array.isArray(json[key])) return json[key];
  }
  for (const value of Object.values(json)) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function parseFollowers(json) {
  return recordsToMap(pickArray(json, ['relationships_followers', 'followers']));
}

export function parseFollowing(json) {
  return recordsToMap(pickArray(json, ['relationships_following', 'following']));
}

export function parsePending(json) {
  return recordsToMap(pickArray(json, ['relationships_follow_requests_sent']));
}

/** Pulls every Instagram profile link out of an HTML export page. */
export function parseHtmlProfiles(html) {
  const out = new Map();
  const re = /href\s*=\s*["'](https?:\/\/(?:www\.)?instagram\.com\/[^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const username = normalizeUsername(m[1]);
    if (username && !out.has(username)) out.set(username, null);
  }
  return out;
}

/**
 * Looks at a parsed JSON export file and says what it contains.
 * Returns one of: 'followers' | 'following' | 'pending' | 'connections' | 'array' | null
 */
export function detectJsonKind(json) {
  if (Array.isArray(json)) return 'array';
  if (!json || typeof json !== 'object') return null;
  if (Array.isArray(json.relationships_followers)) return 'followers';
  if (Array.isArray(json.relationships_following)) return 'following';
  if (Array.isArray(json.relationships_follow_requests_sent)) return 'pending';
  if (isPlainObject(json.followers) && isPlainObject(json.following)) return 'connections';
  return null;
}

export function parseConnections(json) {
  return {
    followers: objectMapToMap(json.followers || {}),
    following: objectMapToMap(json.following || {}),
    pending: objectMapToMap(json.follow_requests_sent || {}),
  };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
