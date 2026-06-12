# Privacy Policy — Today

_Last updated: June 12, 2026_

**Today** is a daily planner browser extension (new tab page and side panel with a checklist, hourly agenda, and notes). It is built so that your data stays yours.

## What data the extension handles

- **Planner content** — your checklist items, agenda entries, and notes. This data is stored in your browser (IndexedDB) and, only if you enable it, synced to a destination you control:
  - a **helper server running on your own machine** (`localhost:8765`), and/or
  - a **private GitHub Gist owned by you**, via `api.github.com`.
- **Authentication information** — if you enable Gist sync, the GitHub personal access token and Gist ID you provide are stored locally in `chrome.storage.local` and sent only to `api.github.com` to read and write your own Gist. They are never sent anywhere else.
- **Settings** — preferences such as the reminders on/off toggle, stored locally.

## What the extension does NOT do

- It does **not** collect, transmit, or store any data on servers operated by the developer. The developer never sees your data.
- It does **not** read, modify, or track the web pages you visit, your browsing history, your location, or your activity.
- It does **not** sell or transfer user data to third parties.
- It does **not** use your data for advertising, creditworthiness, lending, or any purpose unrelated to the planner itself.

## Data retention and deletion

All data lives in your browser, on your machine, or in your own GitHub account. Removing the extension deletes its local data; you can delete a synced Gist or your helper server's data file yourself at any time. The options page also provides export and import of your data.

## Changes

If this policy changes, the updated version will be published at this URL with a new "Last updated" date.

## Contact

Questions or concerns: open an issue at <https://github.com/wotta/today/issues>.
