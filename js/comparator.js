/**
 * Comparator module for Instagram Followers and Following lists.
 * Performs set difference and intersection operations.
 */

export function compareRelationshipSets(followersSet, followingSet) {
  const notFollowingBack = [];
  const notFollowedBack = [];
  const mutuals = [];

  // Who you follow that doesn't follow you back (in followingSet but NOT in followersSet)
  for (const user of followingSet) {
    if (!followersSet.has(user)) {
      notFollowingBack.push(user);
    } else {
      mutuals.push(user);
    }
  }

  // Who follows you that you don't follow back (in followersSet but NOT in followingSet)
  for (const user of followersSet) {
    if (!followingSet.has(user)) {
      notFollowedBack.push(user);
    }
  }

  // Sort lists alphabetically for clean wireframe display
  notFollowingBack.sort((a, b) => a.localeCompare(b));
  notFollowedBack.sort((a, b) => a.localeCompare(b));
  mutuals.sort((a, b) => a.localeCompare(b));

  return {
    stats: {
      followersCount: followersSet.size,
      followingCount: followingSet.size,
      notFollowingBackCount: notFollowingBack.length,
      notFollowedBackCount: notFollowedBack.length,
      mutualsCount: mutuals.length
    },
    lists: {
      notFollowingBack,
      notFollowedBack,
      mutuals
    }
  };
}
