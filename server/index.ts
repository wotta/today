import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { buildMcpServer } from './mcp';
import { store, DATA_PATH, type ChangeEvent } from './store';
import { todayKey } from './date';
import { DayEntrySchema, DATE_RE } from './types';

const PORT = Number(process.env.TODAY_PORT ?? 8765);
const HOST = '127.0.0.1';
const NAME = 'today';
const VERSION = '0.1.0';

await store.init();

const app = express();
app.use(express.json({ limit: '2mb' }));

/**
 * CORS for the browser extension only. We reflect the Origin solely for
 * extension origins so arbitrary websites a user visits can't reach this
 * localhost server. MCP clients are local processes and don't need CORS.
 *
 * TODAY_ALLOW_ORIGINS (comma-separated) adds extra exact-match origins — handy
 * when running the new-tab page from a dev server during development.
 */
const EXTRA_ORIGINS = new Set(
  (process.env.TODAY_ALLOW_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
);

function allowedOrigin(origin: string | undefined): origin is string {
  if (!origin) return false;
  return (
    origin.startsWith('chrome-extension://') ||
    origin.startsWith('moz-extension://') ||
    EXTRA_ORIGINS.has(origin)
  );
}

app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Today-Client');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// --- MCP endpoint (Streamable HTTP, stateful sessions) ---
// One transport per client session, keyed by the Mcp-Session-Id header.
const transports: Record<string, StreamableHTTPServerTransport> = {};

app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport = sessionId ? transports[sessionId] : undefined;

    if (!transport && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        enableDnsRebindingProtection: true,
        allowedHosts: [`127.0.0.1:${PORT}`, `localhost:${PORT}`],
        onsessioninitialized: (sid) => {
          transports[sid] = transport!;
        },
      });
      transport.onclose = () => {
        if (transport!.sessionId) delete transports[transport!.sessionId];
      };
      await buildMcpServer().connect(transport);
    } else if (!transport) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: missing or unknown session id.' },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('today: MCP request failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
    }
  }
});

// GET (server->client SSE) and DELETE (terminate) reuse the session's transport.
const handleSession = async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  const transport = sessionId ? transports[sessionId] : undefined;
  if (!transport) {
    res.status(400).send('Invalid or missing Mcp-Session-Id header.');
    return;
  }
  await transport.handleRequest(req, res);
};
app.get('/mcp', handleSession);
app.delete('/mcp', handleSession);

// --- Sync REST API for the extension ---
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: NAME, version: VERSION, today: todayKey() });
});

app.get('/api/days', (_req, res) => {
  res.json(store.listDays());
});

app.get('/api/day/:date', (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date)) {
    res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
    return;
  }
  res.json(store.getDay(date));
});

app.put('/api/day/:date', async (req, res) => {
  const { date } = req.params;
  const parsed = DayEntrySchema.safeParse({ ...req.body, date });
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid day payload.', details: parsed.error.issues });
    return;
  }
  const origin = (req.headers['x-today-client'] as string) || (req.query.origin as string) || null;
  const saved = await store.putDay(parsed.data, origin);
  res.json(saved);
});

// --- Live change feed (SSE) so an open tab reflects MCP edits instantly ---
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Mirror the CORS header set by the /api middleware for EventSource.
    ...(allowedOrigin(req.headers.origin) ? { 'Access-Control-Allow-Origin': req.headers.origin } : {}),
  });
  res.write(': connected\n\n');

  const onChange = (ev: ChangeEvent) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  store.on('change', onChange);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(keepAlive);
    store.off('change', onChange);
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Today helper server running:`);
  console.log(`  MCP endpoint : http://${HOST}:${PORT}/mcp`);
  console.log(`  Sync API     : http://${HOST}:${PORT}/api`);
  console.log(`  Data file    : ${DATA_PATH}`);
});
