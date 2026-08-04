/**
 * Sample Instagram export data for Demo / Testing mode.
 * Replicates exact JSON structures from Instagram data downloads.
 */

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
