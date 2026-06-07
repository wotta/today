import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Today',
    description: 'A daily dashboard new tab: checklist + hourly agenda.',
    // Lets the new-tab page sync with the local helper server (MCP bridge).
    host_permissions: ['http://127.0.0.1:8765/*', 'http://localhost:8765/*'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
