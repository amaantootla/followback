/**
 * Robust Instagram JSON Parser
 * Handles various Instagram export JSON formats for followers and following lists.
 */

export function normalizeUsername(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let name = raw.trim().toLowerCase();
  
  // If it's a full Instagram URL, extract the username
  if (name.includes('instagram.com/')) {
    try {
      // Remove query params or hash if any
      const urlObj = new URL(name.startsWith('http') ? name : `https://${name}`);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      // Instagram URLs might be /_u/username or /username
      if (parts.length > 0) {
        name = parts[parts.length - 1] === '' ? parts[parts.length - 2] : parts[parts.length - 1];
        if (parts[0] === '_u' && parts.length > 1) {
          name = parts[1];
        }
      }
    } catch (e) {
      // Fallback regex extraction if URL parsing fails
      const match = name.match(/instagram\.com\/(?:_u\/)?([^\/\?#]+)/);
      if (match && match[1]) {
        name = match[1];
      }
    }
  }

  // Remove leading @ if present
  if (name.startsWith('@')) {
    name = name.slice(1);
  }

  // Clean up any remaining trailing slashes or spaces
  name = name.replace(/\/+$/, '').trim();

  return name || null;
}

/**
 * Extracts a username from a single record item in Instagram's JSON list
 */
function extractUsernameFromItem(item) {
  if (!item) return null;

  // Case 1: string directly
  if (typeof item === 'string') {
    return normalizeUsername(item);
  }

  // Case 2: check string_list_data[0].value
  if (Array.isArray(item.string_list_data) && item.string_list_data.length > 0) {
    const firstObj = item.string_list_data[0];
    if (firstObj.value && typeof firstObj.value === 'string' && firstObj.value.trim() !== '') {
      const parsed = normalizeUsername(firstObj.value);
      if (parsed) return parsed;
    }
    // Check href if value is empty
    if (firstObj.href && typeof firstObj.href === 'string' && firstObj.href.trim() !== '') {
      const parsed = normalizeUsername(firstObj.href);
      if (parsed) return parsed;
    }
  }

  // Case 3: check title property
  if (item.title && typeof item.title === 'string' && item.title.trim() !== '') {
    const parsed = normalizeUsername(item.title);
    if (parsed) return parsed;
  }

  // Case 4: check if item itself has value or href or username
  if (item.username) return normalizeUsername(item.username);
  if (item.value) return normalizeUsername(item.value);
  if (item.href) return normalizeUsername(item.href);

  return null;
}

/**
 * Parses a followers JSON structure (can be array or wrapped object)
 * Returns a Set of normalized usernames
 */
export function parseFollowers(jsonInput) {
  const usernames = new Set();
  let items = [];

  if (Array.isArray(jsonInput)) {
    items = jsonInput;
  } else if (jsonInput && typeof jsonInput === 'object') {
    // Check common wrapper properties
    if (Array.isArray(jsonInput.relationships_followers)) {
      items = jsonInput.relationships_followers;
    } else if (Array.isArray(jsonInput.followers)) {
      items = jsonInput.followers;
    } else {
      // Look for first array property in object
      for (const key of Object.keys(jsonInput)) {
        if (Array.isArray(jsonInput[key])) {
          items = jsonInput[key];
          break;
        }
      }
    }
  }

  for (const item of items) {
    const username = extractUsernameFromItem(item);
    if (username) {
      usernames.add(username);
    }
  }

  return usernames;
}

/**
 * Parses a following JSON structure (can be wrapped object or array)
 * Returns a Set of normalized usernames
 */
export function parseFollowing(jsonInput) {
  const usernames = new Set();
  let items = [];

  if (Array.isArray(jsonInput)) {
    items = jsonInput;
  } else if (jsonInput && typeof jsonInput === 'object') {
    if (Array.isArray(jsonInput.relationships_following)) {
      items = jsonInput.relationships_following;
    } else if (Array.isArray(jsonInput.following)) {
      items = jsonInput.following;
    } else {
      // Look for first array property in object
      for (const key of Object.keys(jsonInput)) {
        if (Array.isArray(jsonInput[key])) {
          items = jsonInput[key];
          break;
        }
      }
    }
  }

  for (const item of items) {
    const username = extractUsernameFromItem(item);
    if (username) {
      usernames.add(username);
    }
  }

  return usernames;
}
