import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Today',
    description: 'A daily dashboard new tab: checklist + hourly agenda.',
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
