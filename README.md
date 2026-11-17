# Followback

See who doesn't follow you back on Instagram.

Everything runs in your browser. Nothing is uploaded or sent anywhere.

## Usage

1. **Get your export.** Go to Instagram → Accounts Center → **Your information and permissions** → **Export your information** → Create export → Export to device. Pick **Followers and following**, set **Date range** to **All time** (the default only covers the last year), and choose JSON or HTML.
2. **Drop it in.** Drag the zip onto the page as it is. You can also drop the unzipped folder, or just the loose `followers_*.json` / `following.json` files. The app finds the right files itself, including split `followers_1/2/3` files, HTML exports, multi-part zips and the old `connections.json` format.
3. **Work through the list.** Search, sort by follow date, open profiles (the ones you've opened get marked), and copy or export the list as CSV.

## Development

No build step. Serve the folder with any static server (ES modules don't load from `file://`):

```sh
python3 -m http.server
npm test
```

---
*Not affiliated with, associated with, or endorsed by Instagram or Meta.*
