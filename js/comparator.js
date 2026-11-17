/**
 * Set difference / intersection between followers and following.
 * Accepts Sets or Maps (only keys are used). Lists come back sorted A–Z.
 */

export function compareRelationshipSets(followers, following) {
  const notFollowingBack = [];
  const notFollowedBack = [];
  const mutuals = [];

  for (const user of following.keys()) {
    (followers.has(user) ? mutuals : notFollowingBack).push(user);
  }
  for (const user of followers.keys()) {
    if (!following.has(user)) notFollowedBack.push(user);
  }

  const byName = (a, b) => a.localeCompare(b);
  notFollowingBack.sort(byName);
  notFollowedBack.sort(byName);
  mutuals.sort(byName);

  return {
    stats: {
      followersCount: followers.size,
      followingCount: following.size,
      notFollowingBackCount: notFollowingBack.length,
      notFollowedBackCount: notFollowedBack.length,
      mutualsCount: mutuals.length,
    },
    lists: { notFollowingBack, notFollowedBack, mutuals },
  };
}
