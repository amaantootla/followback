/**
 * Sample Instagram export data.
 * SAMPLE_* replicate the exact JSON structures from Instagram data downloads (used by tests).
 * buildDemoData() generates a larger, realistic-looking set for the "Try sample data" button.
 */

const DEMO_A = ['sunny', 'urban', 'quiet', 'wild', 'golden', 'little', 'north', 'salt', 'velvet', 'paper', 'copper', 'midnight', 'coastal', 'lazy', 'tiny', 'foggy', 'maple', 'olive', 'rusty', 'indigo'];
const DEMO_B = ['studio', 'kitchen', 'trails', 'films', 'press', 'garden', 'cycles', 'coffee', 'records', 'lens', 'atlas', 'diaries', 'club', 'supply', 'notes', 'house', 'works', 'daily', 'bakery', 'goods'];
const DEMO_SUFFIX = ['', '', '', '_', '.co', '.official', '_hq', '22', '.la', '_photo'];

export function buildDemoData() {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const now = Math.floor(Date.now() / 1000);
  const year = 365 * 24 * 3600;
  const names = new Set();
  while (names.size < 240) {
    const a = DEMO_A[Math.floor(rand() * DEMO_A.length)];
    const b = DEMO_B[Math.floor(rand() * DEMO_B.length)];
    const s = DEMO_SUFFIX[Math.floor(rand() * DEMO_SUFFIX.length)];
    names.add(`${a}${rand() < 0.4 ? '.' : rand() < 0.5 ? '_' : ''}${b}${s}`);
  }
  const followers = new Map();
  const following = new Map();
  const pending = new Map();
  for (const name of names) {
    const r = rand();
    const ts = now - Math.floor(rand() * 4 * year);
    if (r < 0.62) { followers.set(name, Math.min(now, ts + Math.floor(rand() * 3600 * 24 * 30))); following.set(name, ts); }
    else if (r < 0.82) following.set(name, ts);
    else if (r < 0.97) followers.set(name, ts);
    else pending.set(name, now - Math.floor(rand() * 0.3 * year));
  }
  return { followers, following, pending };
}

export const SAMPLE_FOLLOWERS_JSON = [
  {
    "title": "",
    "media_list_data": [],
    "string_list_data": [
      {
        "href": "https://www.instagram.com/xyz1",
        "value": "xyz1",
        "timestamp": 1785790946
      }
    ]
  },
  {
    "title": "",
    "media_list_data": [],
    "string_list_data": [
      {
        "href": "https://www.instagram.com/xyz2",
        "value": "xyz2",
        "timestamp": 1785789843
      }
    ]
  },
  {
    "title": "",
    "media_list_data": [],
    "string_list_data": [
      {
        "href": "https://www.instagram.com/mutual_friend",
        "value": "mutual_friend",
        "timestamp": 1785789000
      }
    ]
  },
  {
    "title": "",
    "media_list_data": [],
    "string_list_data": [
      {
        "href": "https://www.instagram.com/fan_account_99",
        "value": "fan_account_99",
        "timestamp": 1785788000
      }
    ]
  }
];

export const SAMPLE_FOLLOWING_JSON = {
  "relationships_following": [
    {
      "title": "xyz1",
      "string_list_data": [
        {
          "href": "https://www.instagram.com/_u/xyz1",
          "timestamp": 1785796094
        }
      ]
    },
    {
      "title": "xyz2",
      "string_list_data": [
        {
          "href": "https://www.instagram.com/_u/xyz2",
          "timestamp": 1785796072
        }
      ]
    },
    {
      "title": "mutual_friend",
      "string_list_data": [
        {
          "href": "https://www.instagram.com/_u/mutual_friend",
          "timestamp": 1785795000
        }
      ]
    },
    {
      "title": "celebrity_account",
      "string_list_data": [
        {
          "href": "https://www.instagram.com/_u/celebrity_account",
          "timestamp": 1785794000
        }
      ]
    },
    {
      "title": "ghost_follower",
      "string_list_data": [
        {
          "href": "https://www.instagram.com/_u/ghost_follower",
          "timestamp": 1785793000
        }
      ]
    }
  ]
};
