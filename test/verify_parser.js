import assert from 'assert';
import { deflateRawSync } from 'zlib';
import { parseFollowers, parseFollowing, normalizeUsername, parseHtmlProfiles } from '../js/parser.js';
import { compareRelationshipSets } from '../js/comparator.js';
import { importFiles, kindFromName } from '../js/importer.js';
import { listZipEntries } from '../js/zip.js';
import { SAMPLE_FOLLOWERS_JSON, SAMPLE_FOLLOWING_JSON, buildDemoData } from '../js/sampleData.js';

console.log('--- Running Verification Tests ---');

// 1. normalizeUsername
assert.strictEqual(normalizeUsername('xyz1'), 'xyz1');
assert.strictEqual(normalizeUsername('  @xyz1  '), 'xyz1');
assert.strictEqual(normalizeUsername('https://www.instagram.com/xyz1'), 'xyz1');
assert.strictEqual(normalizeUsername('https://www.instagram.com/_u/xyz1'), 'xyz1');
assert.strictEqual(normalizeUsername('https://www.instagram.com/xyz1/?hl=en'), 'xyz1');
assert.strictEqual(normalizeUsername('https://www.instagram.com/accounts/login'), null, 'Non-profile paths rejected');
assert.strictEqual(normalizeUsername('not a username!'), null, 'Junk rejected');
console.log('✓ normalizeUsername');

// 2. parseFollowers / parseFollowing on Instagram-shaped data
const followers = parseFollowers(SAMPLE_FOLLOWERS_JSON);
assert.ok(followers.has('xyz1') && followers.has('xyz2') && followers.has('mutual_friend'));
assert.strictEqual(followers.size, 4);
assert.strictEqual(followers.get('xyz1'), 1785790946, 'Keeps timestamps');
const following = parseFollowing(SAMPLE_FOLLOWING_JSON);
assert.ok(following.has('xyz1') && following.has('celebrity_account'));
assert.strictEqual(following.size, 5);
console.log('✓ parseFollowers / parseFollowing');

// 3. compareRelationshipSets (works with Maps and Sets)
const cmp = compareRelationshipSets(followers, following);
assert.deepStrictEqual(cmp.lists.notFollowingBack, ['celebrity_account', 'ghost_follower']);
assert.deepStrictEqual(cmp.lists.notFollowedBack, ['fan_account_99']);
assert.deepStrictEqual(cmp.lists.mutuals, ['mutual_friend', 'xyz1', 'xyz2']);
const cmpSets = compareRelationshipSets(new Set(followers.keys()), new Set(following.keys()));
assert.deepStrictEqual(cmpSets.lists, cmp.lists);
console.log('✓ compareRelationshipSets');

// 4. HTML exports
const html = `<html><head><title>Following</title></head><body>
  <div><h2>xyz1</h2><a target="_blank" href="https://www.instagram.com/_u/xyz1">https://www.instagram.com/_u/xyz1</a></div>
  <div><a target="_blank" href="https://www.instagram.com/celebrity_account">celebrity_account</a></div>
</body></html>`;
assert.deepStrictEqual([...parseHtmlProfiles(html).keys()], ['xyz1', 'celebrity_account']);
console.log('✓ parseHtmlProfiles');

// 5. Filename classification — close names must not be confused
assert.strictEqual(kindFromName('connections/followers_and_following/followers_1.json'), 'followers');
assert.strictEqual(kindFromName('followers_12.json'), 'followers');
assert.strictEqual(kindFromName('following.json'), 'following');
assert.strictEqual(kindFromName('following.html'), 'following');
assert.strictEqual(kindFromName('following_hashtags.json'), null);
assert.strictEqual(kindFromName('close_friends.json'), null);
assert.strictEqual(kindFromName('follow_requests_you\'ve_received.json'), null);
assert.strictEqual(kindFromName('pending_follow_requests.json'), 'pending');
console.log('✓ kindFromName');

// --- helpers to build zips in memory ---
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function makeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const raw = Buffer.from(typeof content === 'string' ? content : JSON.stringify(content));
    const comp = deflateRawSync(raw);
    const crc = crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8);
    ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameBuf, comp);
    centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  const count = Object.keys(files).length;
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(count, 8); eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return new Blob([Buffer.concat([...locals, cd, eocd])]);
}

const igItem = (u, ts = 1700000000) => ({ title: '', media_list_data: [], string_list_data: [{ href: `https://www.instagram.com/${u}`, value: u, timestamp: ts }] });
const igFollowingItem = (u, ts = 1700000000) => ({ title: u, string_list_data: [{ href: `https://www.instagram.com/_u/${u}`, timestamp: ts }] });

// 6. Full export zip: split followers, decoys, macOS junk
const exportZip = makeZip({
  'connections/followers_and_following/followers_1.json': [igItem('alice'), igItem('bob')],
  'connections/followers_and_following/followers_2.json': [igItem('carol')],
  'connections/followers_and_following/following.json': { relationships_following: [igFollowingItem('alice'), igFollowingItem('dave'), igFollowingItem('erin')] },
  'connections/followers_and_following/following_hashtags.json': { relationships_following_hashtags: [igFollowingItem('photography')] },
  'connections/followers_and_following/close_friends.json': { relationships_close_friends: [igItem('zed')] },
  'connections/followers_and_following/pending_follow_requests.json': { relationships_follow_requests_sent: [igItem('frank')] },
  '__MACOSX/connections/followers_and_following/._following.json': 'garbage',
  'media/posts/202401/photo.jpg': 'not really a jpg',
});
const entries = await listZipEntries(exportZip);
assert.strictEqual(entries.length, 8);

const res = await importFiles([{ path: 'instagram-me-2026-11-16.zip', file: exportZip }]);
assert.deepStrictEqual(res.errors, []);
assert.deepStrictEqual([...res.followers.keys()].sort(), ['alice', 'bob', 'carol'], 'Merges followers_1 + followers_2');
assert.deepStrictEqual([...res.following.keys()].sort(), ['alice', 'dave', 'erin'], 'Ignores following_hashtags');
assert.deepStrictEqual([...res.pending.keys()], ['frank']);
console.log('✓ importFiles: full export zip');

// 7. Loose files with wrong/renamed names are classified by content
const renamedFollowing = new Blob([JSON.stringify({ relationships_following: [igFollowingItem('dave')] })]);
const renamedFollowers = new Blob([JSON.stringify([igItem('alice')])]);
const res2 = await importFiles([
  { path: 'download (3).json', file: renamedFollowing },
  { path: 'my stuff.json', file: renamedFollowers },
]);
assert.deepStrictEqual([...res2.following.keys()], ['dave']);
assert.deepStrictEqual([...res2.followers.keys()], ['alice']);
console.log('✓ importFiles: renamed loose files detected by content');

// 8. Folder drop: only plausible files are read, media is skipped
const res3 = await importFiles([
  { path: 'export/connections/followers_and_following/following.html', file: new Blob([html]) },
  { path: 'export/connections/followers_and_following/followers_1.html', file: new Blob(['<a href="https://www.instagram.com/xyz1">xyz1</a>']) },
  { path: 'export/media/x.json', file: new Blob(['{"relationships_following":[]}']) },
]);
assert.deepStrictEqual([...res3.following.keys()], ['xyz1', 'celebrity_account']);
assert.deepStrictEqual([...res3.followers.keys()], ['xyz1']);
console.log('✓ importFiles: HTML export folder');

// 9. Legacy connections.json
const legacy = new Blob([JSON.stringify({ followers: { alice: '2019-01-01T00:00:00+00:00' }, following: { alice: '2019-01-02T00:00:00+00:00', bob: '2019-01-03T00:00:00+00:00' } })]);
const res4 = await importFiles([{ path: 'connections.json', file: legacy }]);
assert.deepStrictEqual([...res4.followers.keys()], ['alice']);
assert.deepStrictEqual([...res4.following.keys()], ['alice', 'bob']);
assert.ok(res4.following.get('bob') > 0);
console.log('✓ importFiles: legacy connections.json');

// 10. A zip without the data reports nothing found, not a crash
const res5 = await importFiles([{ path: 'other.zip', file: makeZip({ 'readme.txt': 'hi' }) }]);
assert.ok(!res5.followers && !res5.following);
console.log('✓ importFiles: unrelated zip');

// 11. Demo data is deterministic and non-trivial
const demo = buildDemoData();
assert.ok(demo.followers.size > 100 && demo.following.size > 100);
assert.deepStrictEqual([...buildDemoData().following.keys()], [...demo.following.keys()]);
console.log('✓ buildDemoData');

console.log('--- All Verification Tests Passed ---');
