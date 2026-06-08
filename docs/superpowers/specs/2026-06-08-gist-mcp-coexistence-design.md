# Gist + MCP Coexistence — Design Spec

**Date:** 2026-06-08
**Status:** Decided & implemented — simplest variant
**Follows:** [2026-06-08-gist-backend-design.md](./2026-06-08-gist-backend-design.md)

---

## Decision (what was built)

We chose the **simplest** model, not the staged "server prefers" design explored
below: **one switch, honored everywhere.** When gist mode is on, *every* part of
the app that persists data uses the Gist API; when it's off, everything uses
local storage (IndexedDB in the browser, the JSON file on the server).

- The **Options page** is the single place to configure it. On Save it stores the
  PAT + id in `chrome.storage.local` (for the extension) **and** POSTs them to the
  server (`POST /api/gist-config` → `~/.today/config.json`). Disconnect clears both.
- The **server's `Store`** picks its backend per-operation from
  `getGistConfig()`: Gist when configured, local file otherwise. MCP tools and
  the `/api` REST endpoints both go through `Store`, so they follow the switch
  automatically.
- Both the extension and the server therefore write the **same** Gist directly.
  To keep them from clobbering each other, both do **load-before-write**: fetch
  the latest envelope, apply the one changed day, then PATCH.

**Accepted limitation:** two writers editing the *same day* within the same
moment is still last-write-wins (no locking on a single Gist file). Per-day
load-before-write makes cross-day clobbering a non-issue; same-day races are rare
for a single user and explicitly out of scope. There's also no live feed in gist
mode, so an open tab needs a refresh to see an AI edit (matches the prior spec).

The exploration below is kept for context; the "server prefers / offline
fallback" parts were **not** built.

---

## Problem

The Gist backend (previous spec, now implemented) lets the new-tab page sync to a
private GitHub Gist with **no local helper server required**. But that creates a
blind spot:

- The **MCP tools** (`get_day`, `toggle_check_item`, …) read and write the
  server's own store (`~/.today/data.json`). They never touch the Gist.
- The **Gist** is reachable only with the PAT, which lives in
  `chrome.storage.local` — sandboxed to the extension. The server (and therefore
  any AI tool) cannot read it.

So when Gist is active, the two data stores diverge: edits made in the browser go
to the Gist; edits made by AI tools go to the local file; neither sees the other.
With Gist enabled, **the MCP server is effectively dead weight.**

Goal: one shared source of truth so AI tools and the browser edit the same data,
whether or not Gist is configured.

---

## The core constraint

The Gist is a **single JSON file with no locking or transactions**. GitHub's
PATCH replaces the whole file; there's no `If-Match`/compare-and-swap. So the
only real design question is:

> **Who is allowed to write the Gist, and how do we avoid lost updates when more
> than one writer exists?**

Today there are two potential writers: the browser (direct, via `gist.ts`) and —
if we make it Gist-aware — the server (for MCP edits). Two independent
full-file PATCHes race; last write wins; the loser's edit vanishes.

---

## Current architecture (what we're building on)

```
                 ┌─ MCP tools ─┐
AI tool ────────▶│  (mcp.ts)   │
                 └──────┬──────┘
                        ▼
                  ┌───────────┐      persist        ┌──────────────────┐
                  │  Store    │───────────────────▶ │ ~/.today/data.json│
                  │ (single   │                     └──────────────────┘
   extension ────▶│  source   │
   (api.ts) PUT   │ of truth) │── emit 'change' ──▶ SSE /api/events ──▶ open tab
                  └───────────┘
```

The server already solves the multi-writer problem **for the local case**: it is
the single writer, the extension writes through it (`PUT /api/day`), and the SSE
feed pushes AI edits back to the open tab. We want to preserve this and add Gist
durability/portability on top.

---

## Recommended approach: server owns the Gist; extension prefers the server

Make the **server's persistence layer** be "local file (cache) + Gist (publish)",
and have the extension **prefer the server**, falling back to direct-Gist only
when the server is down.

```
            ┌─ MCP tools ─┐
AI tool ───▶│             │
            └──────┬──────┘
                   ▼
             ┌───────────┐  persist   ┌──────────────────┐
extension ──▶│  Store    │──────────▶ │ data.json (cache) │
(api.ts) ───▶│           │──────────▶ │ GitHub Gist (sync)│◀── other device's server
             └─────┬─────┘            └──────────────────┘
                   └─ SSE ─▶ open tab
        (extension uses gist.ts DIRECTLY only when the server is unreachable)
```

### How it works

1. **Server becomes Gist-aware.** When a Gist PAT + id is configured, `Store`
   writes through to the Gist on every `commit()` (in addition to the local file)
   and pulls the Gist on startup and on a short poll interval (GitHub has no push).
2. **The extension prefers the server.** `backend.ts` selection becomes:
   - server reachable → use `api.ts` (server handles Gist + MCP + SSE);
   - server down + Gist configured locally → use `gist.ts` (offline/serverless).
   This reuses *both* pieces already built: the server path for the shared
   source of truth, and the extension's direct-Gist path as an offline fallback.
3. **One place to enter the PAT.** The Options page keeps the PAT/Gist-id form,
   but on save it also hands them to the server over localhost
   (`POST /api/gist-config`), which stores them in `~/.today/config.json`. The
   PAT stays in `chrome.storage.local` too, for the serverless fallback path.
4. **Cross-device sync** is "each device's server points at the same Gist." The
   poll interval reconciles edits made elsewhere; the SSE feed surfaces them in
   the open tab, exactly like local MCP edits today.

### Conflict model

- **Normal operation (server up):** the server is the *only* Gist writer →
  no lost updates, same guarantee as today's local model.
- **The one risky window:** server was down, the extension wrote directly to the
  Gist, then the server comes back. Resolve with **per-day read-merge-write** on
  the server's next pull: GET the Gist, and for each day take the newer of
  {local, remote} rather than blind last-write-wins. Day-level granularity is
  enough for a single user across their own tools.
- Simultaneous multi-device editing of the **same day** within one poll interval
  remains out of scope (matches the prior spec).

### What changes in the code we just wrote

- `gist.ts` stays, but its role narrows to the **offline/no-server fallback**.
- `backend.ts` selection gains a "is the server reachable?" probe in front of the
  existing GistConfig check.
- New: server-side Gist client + config (`server/gist.ts`, `server/config.ts`),
  `POST /api/gist-config`, and a poll loop.
- `Store.persist()` gains a write-through to the Gist; `Store.init()` and the
  poll loop gain a pull+merge.

---

## Alternatives considered

### B. Server-only Gist (drop the extension's direct-Gist path)

The server owns the Gist; the extension *always* talks to the server; the
serverless mode is removed. Simplest conflict story (truly one writer), and the
cleanest code. **Cost:** loses the "works without a server" property that
motivated the original Gist spec — the extension is useless on a machine with no
helper server.

### C. Gist as shared store, both write directly (no server involvement)

Keep the extension writing the Gist directly and teach the **MCP server to be a
second direct Gist client** (no local file authority). Both PATCH the same file
with per-day read-merge-write. **Cost:** two live writers all the time →
the conflict window is permanent, not just "server was down"; and the server must
poll the Gist constantly to keep MCP reads fresh. More moving parts, weaker
guarantees than the recommended approach.

---

## Open questions

1. **PAT trust boundary.** Moving the PAT to `~/.today/config.json` (plaintext on
   disk) is a different trust model than the sandboxed `chrome.storage.local`.
   Acceptable for a local-first dev tool? Encrypt at rest? Env var only?
2. **Poll interval.** How fresh must MCP reads be? 10s? 30s? On-demand fetch
   before each tool call instead of polling?
3. **Is serverless mode worth keeping?** If the realistic usage is "server always
   running for MCP anyway," Alternative B is materially simpler. Does anyone
   actually run the extension with no server?
4. **Merge granularity.** Is per-day last-write-wins-by-timestamp enough, or do we
   need per-item merge for the checklist?

---

## Recommendation

Go with the **server-owned Gist** approach: it directly fixes "MCP for nothing,"
reuses both halves of what's already built, preserves the proven single-writer
model for the common case, and contains conflict risk to a narrow, resolvable
window. Decide Open Question #3 first — if serverless mode isn't actually used,
collapse to Alternative B and save meaningful complexity.
