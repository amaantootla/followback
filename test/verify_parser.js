import assert from 'assert';
import { parseFollowers, parseFollowing, normalizeUsername } from '../js/parser.js';
import { compareRelationshipSets } from '../js/comparator.js';
import { SAMPLE_FOLLOWERS_JSON, SAMPLE_FOLLOWING_JSON } from '../js/sampleData.js';

console.log('--- Running Verification Tests ---');

// 1. Test normalizeUsername
assert.strictEqual(normalizeUsername('xyz1'), 'xyz1', 'Should leave plain username intact');
assert.strictEqual(normalizeUsername('  @xyz1  '), 'xyz1', 'Should trim and strip @');
assert.strictEqual(normalizeUsername('https://www.instagram.com/xyz1'), 'xyz1', 'Should parse standard Instagram URL');
assert.strictEqual(normalizeUsername('https://www.instagram.com/_u/xyz1'), 'xyz1', 'Should parse _u Instagram URL');
console.log('✓ normalizeUsername tests passed');

// 2. Test parseFollowers on prompt sample data
const followersSet = parseFollowers(SAMPLE_FOLLOWERS_JSON);
assert.ok(followersSet.has('xyz1'), 'Followers set should contain xyz1');
assert.ok(followersSet.has('xyz2'), 'Followers set should contain xyz2');
assert.ok(followersSet.has('mutual_friend'), 'Followers set should contain mutual_friend');
assert.strictEqual(followersSet.size, 4, 'Followers set size should be 4');
console.log('✓ parseFollowers tests passed');

// 3. Test parseFollowing on prompt sample data
const followingSet = parseFollowing(SAMPLE_FOLLOWING_JSON);
assert.ok(followingSet.has('xyz1'), 'Following set should contain xyz1');
assert.ok(followingSet.has('xyz2'), 'Following set should contain xyz2');
assert.ok(followingSet.has('celebrity_account'), 'Following set should contain celebrity_account');
assert.strictEqual(followingSet.size, 5, 'Following set size should be 5');
console.log('✓ parseFollowing tests passed');

// 4. Test compareRelationshipSets
const comparison = compareRelationshipSets(followersSet, followingSet);
assert.strictEqual(comparison.stats.notFollowingBackCount, 2, 'Should have 2 accounts not following back');
assert.deepStrictEqual(comparison.lists.notFollowingBack, ['celebrity_account', 'ghost_follower']);

assert.strictEqual(comparison.stats.notFollowedBackCount, 1, 'Should have 1 account not followed back');
assert.deepStrictEqual(comparison.lists.notFollowedBack, ['fan_account_99']);

assert.strictEqual(comparison.stats.mutualsCount, 3, 'Should have 3 mutual accounts');
assert.deepStrictEqual(comparison.lists.mutuals, ['mutual_friend', 'xyz1', 'xyz2']);
console.log('✓ compareRelationshipSets tests passed');

console.log('--- All Verification Tests Passed Successfully! ---');
