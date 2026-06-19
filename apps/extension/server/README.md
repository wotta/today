# Today — MCP helper server

A small local server that lets AI tools read and write the **Today** planner
(the same checklist + hourly agenda the browser extension shows).

It is the **source of truth**: AI edits land immediately (even with the browser
closed), and an open new-tab page reflects them live. The extension keeps a
local copy as an offline cache for when this server isn't running.

```
AI tool (Claude Code / Cursor / …)        Browser extension (new tab)
        │  MCP over HTTP                            │  sync REST + SSE
        └──────────────►  today helper server  ◄────┘
                          (canonical JSON store)
```

## Run it

```sh
bun run server          # from the repo root
```

You should see:

```
Today helper server running:
  MCP endpoint : http://127.0.0.1:8765/mcp
  Sync API     : http://127.0.0.1:8765/api
  Data file    : /home/you/.today/data.json
```

The server binds to `127.0.0.1` only (never exposed on the network).

### Configuration (env vars)

| Variable               | Default                 | Purpose                                                        |
| ---------------------- | ----------------------- | -------------------------------------------------------------- |
| `TODAY_PORT`           | `8765`                  | Port. **Must match `PORT` in `entrypoints/newtab/lib/api.ts`.** |
| `TODAY_DATA`           | `~/.today/data.json`    | Where the planner data is stored (atomic writes).              |
| `TODAY_ALLOW_ORIGINS`  | _(none)_                | Comma-separated extra CORS origins, e.g. a dev server URL.     |

By default CORS only allows `chrome-extension://` / `moz-extension://` origins,
so ordinary websites you visit cannot reach this server.

## Connect your AI tool

The MCP endpoint is **`http://127.0.0.1:8765/mcp`** (Streamable HTTP).

**Claude Code**

```sh
claude mcp add --transport http today http://127.0.0.1:8765/mcp
```

**Cursor** — add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "today": { "url": "http://127.0.0.1:8765/mcp" }
  }
}
```

**Claude Desktop** (stdio-only) — bridge with `mcp-remote`:

```json
{
  "mcpServers": {
    "today": { "command": "npx", "args": ["-y", "mcp-remote", "http://127.0.0.1:8765/mcp"] }
  }
}
```

## Tools

| Tool                  | What it does                                                  |
| --------------------- | ------------------------------------------------------------- |
| `get_day`             | Full checklist + agenda for a day (defaults to today).        |
| `list_days`           | All days with saved content, plus item/entry counts.          |
| `add_check_item`      | Append a task to the checklist.                               |
| `update_check_item`   | Edit a task's text and/or done state by id.                   |
| `toggle_check_item`   | Flip a task's done state.                                     |
| `remove_check_item`   | Delete a task by id.                                          |
| `reorder_check_items` | Set checklist order from a list of ids.                       |
| `set_agenda`          | Set an hour's agenda text (empty text clears it).             |
| `clear_agenda`        | Clear an hour's agenda text.                                  |

Dates are `YYYY-MM-DD` in local time and default to today. Agenda hours run
`6`–`26`, where `24`/`25`/`26` mean `0`/`1`/`2`am the next morning. "Today" stays
on the previous calendar day until 2am, matching the planner's page boundary.

## Sync API (used by the extension)

- `GET  /api/health` — `{ ok, name, version, today }`
- `GET  /api/days` — list of days with content
- `GET  /api/day/:date` — a `DayEntry`
- `PUT  /api/day/:date` — replace a day (send `X-Today-Client` to ignore your own echo)
- `GET  /api/events` — SSE stream of `{ date, origin }` change events
