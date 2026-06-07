# Today

A new-tab planner browser extension. Every tab you open shows **today**: a
simple checklist and an hourly agenda. An optional local helper server lets AI
tools (Claude Code, Cursor, Claude Desktop, …) read and write the same planner
over MCP, so your tasks stay in sync between you and your assistants.

Built with [WXT](https://wxt.dev) + React + Tailwind.

## How it works

The extension stores each day locally in IndexedDB, so it works fully offline.
When the helper server is running it becomes the **source of truth**: AI edits
land immediately (even with the browser closed), and any open new-tab page
reflects them live over a server-sent event stream. IndexedDB then acts as an
offline cache for when the server isn't running.

```
AI tool (Claude Code / Cursor / …)        Browser extension (new tab)
        │  MCP over HTTP                            │  sync REST + SSE
        └──────────────►  today helper server  ◄────┘   ↕ IndexedDB cache
                          (canonical JSON store)
```

## Develop

Requires [Bun](https://bun.sh) (or Node) and a Chromium/Firefox browser.

```sh
bun install

bun run dev            # Chrome — launches a dev browser with the extension loaded
bun run dev:firefox    # Firefox
```

## Build

```sh
bun run build          # production build (Chrome) into .output/
bun run build:firefox  # Firefox
bun run zip            # packaged .zip for store submission
```

`bun run compile` type-checks the extension without emitting.

## Helper server (optional)

The local server exposes the planner to AI tools over MCP and to the extension
over a small REST + SSE sync API. It binds to `127.0.0.1` only.

```sh
bun run server
```

See [`server/README.md`](server/README.md) for the available MCP tools,
configuration (`TODAY_PORT`, `TODAY_DATA`, `TODAY_ALLOW_ORIGINS`), and how to
connect Claude Code, Cursor, and Claude Desktop.

## Layout

| Path                  | What it is                                              |
| --------------------- | ------------------------------------------------------- |
| `entrypoints/newtab/` | The new-tab page (React app, IndexedDB cache, sync).    |
| `server/`             | Local MCP + sync helper server (`bun run server`).      |
| `wxt.config.ts`       | Extension manifest and build config.                    |
