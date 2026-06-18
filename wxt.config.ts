import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// WXT defaults build/zip to production mode, so `env.mode` can't tell a plain
// `wxt zip` apart from an explicit `--mode production`. Only the latter is a
// store build, so detect the flag itself.
const isStoreBuild = process.argv.some(
  (arg, i, argv) =>
    (arg === '--mode' && argv[i + 1] === 'production') || arg === '--mode=production',
);

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: () => {
    return {
      name: 'Today',
      description: 'A daily dashboard new tab: checklist + hourly agenda.',
      // Stable key so the extension ID never changes between reinstalls,
      // which keeps IndexedDB intact across builds. The Chrome Web Store
      // rejects manifests that contain `key`, so store builds
      // (`wxt zip --mode production`) drop it. Regenerate with:
      //   openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out .dev-key.pem
      //   openssl rsa -in .dev-key.pem -pubout -outform DER | openssl base64 -A
      ...(!isStoreBuild && {
        key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqYBfagJ9BbfV0riD0sGXok1K728B2iILGp/fEmhzmyUs8jd5Dc6sZMGPno6Z9ulgzqi92GcgPlJatXTT6Vfi2vh1gqbUNe7ejYFiWwEI3KBAXPtsNGNW6jJaVd3CpqCoCFElOjHztoUDKVCmMUNr7j8WuHu1NzMkMAgptpjtYpR/XtphOK5ZsQemC2mP8klS05htdGu3TWGlH8QEz8JIqYhrZx/mZacZ9WsrwxKAEAqr1REJsZ9mba6FYZEgnx2LHvw36i3WpEnCsjV32aQYuE9NrVe2qH6vF/0EhmdQeRqPp9gxkhlg9F0Tx8fz9nqMTpGFP4E8orHOfY/B1cPCcQIDAQAB',
      }),
      // Lets the new-tab page sync with the local helper server (MCP bridge) and,
      // when configured, with the GitHub Gist storage backend.
      host_permissions: [
        'http://127.0.0.1:8765/*',
        'http://localhost:8765/*',
        'https://api.github.com/*',
      ],
      // `storage` holds the Gist PAT + id (chrome.storage.local).
      // `alarms` + `notifications` power the slot reminders in the background script.
      permissions: ['contextMenus', 'sidePanel', 'storage', 'alarms', 'notifications'],
    };
  },
  vite: () => ({
    plugins: [tailwindcss()],
    build: {
      // The heavy chunks (BlockNote's editor + comments, CodeMirror for the
      // notes page) are all lazy-loaded — they never land in the initial
      // planner bundle, so their size isn't an initial-load concern. Raise the
      // warning ceiling above them so it still flags a genuine regression.
      chunkSizeWarningLimit: 800,
    },
  }),
});
