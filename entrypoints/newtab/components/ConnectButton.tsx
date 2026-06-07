import { useEffect, useRef, useState } from 'react';
import { SERVER_BASE } from '../lib/api';

const NAME = 'today';
const MCP_URL = `${SERVER_BASE}/mcp`;

/** cursor://…/mcp/install?name=…&config=<base64 JSON> */
function cursorLink(): string {
  const config = btoa(JSON.stringify({ url: MCP_URL }));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${NAME}&config=${encodeURIComponent(config)}`;
}

/** vscode:mcp/install?<url-encoded JSON> (or vscode-insiders:) */
function vscodeLink(insiders = false): string {
  const obj = { name: NAME, type: 'http', url: MCP_URL };
  return `${insiders ? 'vscode-insiders' : 'vscode'}:mcp/install?${encodeURIComponent(JSON.stringify(obj))}`;
}

const CLAUDE_CODE_CMD = `claude mcp add --transport http ${NAME} ${MCP_URL}`;
const CLAUDE_DESKTOP_JSON = JSON.stringify(
  { mcpServers: { [NAME]: { command: 'npx', args: ['-y', 'mcp-remote', MCP_URL] } } },
  null,
  2,
);

export function ConnectButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-stone-500 shadow-sm backdrop-blur transition-colors hover:text-stone-800 dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-400 dark:hover:text-stone-100"
      >
        <PlugIcon />
        Connect AI
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Connect an AI tool"
          className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-stone-200 bg-white p-3 text-stone-700 shadow-xl dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Connect an AI tool
          </p>

          <div className="flex gap-2">
            <a
              href={cursorLink()}
              className="flex-1 rounded-lg bg-stone-800 px-3 py-1.5 text-center text-[13px] font-medium text-stone-50 transition-colors hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
            >
              Add to Cursor
            </a>
            <a
              href={vscodeLink()}
              className="flex-1 rounded-lg bg-stone-800 px-3 py-1.5 text-center text-[13px] font-medium text-stone-50 transition-colors hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
            >
              Add to VS Code
            </a>
          </div>

          <div className="my-2.5 border-t border-stone-200 dark:border-stone-700" />

          <CopyRow
            label="Claude Code"
            hint="run in your terminal"
            copied={copied === 'cc'}
            onCopy={() => copy('cc', CLAUDE_CODE_CMD)}
          />
          <CopyRow
            label="Claude Desktop"
            hint="paste into config JSON"
            copied={copied === 'cd'}
            onCopy={() => copy('cd', CLAUDE_DESKTOP_JSON)}
          />
          <CopyRow
            label="MCP URL"
            hint={MCP_URL}
            copied={copied === 'url'}
            onCopy={() => copy('url', MCP_URL)}
          />

          <p className="mt-2.5 text-[11px] leading-snug text-stone-400 dark:text-stone-500">
            Requires the Today helper server running (<code>bun run server</code>).
          </p>
        </div>
      )}
    </div>
  );
}

function CopyRow({
  label,
  hint,
  copied,
  onCopy,
}: {
  label: string;
  hint: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        <div className="truncate text-[11px] text-stone-400 dark:text-stone-500">{hint}</div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-500 transition-colors hover:border-stone-400 hover:text-stone-800 dark:border-stone-600 dark:text-stone-400 dark:hover:border-stone-400 dark:hover:text-stone-100"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function PlugIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0V8zM12 16v6" />
    </svg>
  );
}
