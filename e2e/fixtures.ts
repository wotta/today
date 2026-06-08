import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../.output/chrome-mv3',
);

/**
 * Loads the built extension into a persistent Chromium context and exposes the
 * resolved extension id, so tests can open `chrome-extension://<id>/newtab.html`.
 *
 * Extensions require the `chromium` channel (new headless mode) and a
 * persistent context — they cannot be loaded into the default bundled headless
 * Chromium. An empty userDataDir gives each test a fresh profile (and a fresh
 * IndexedDB), so state never bleeds between tests.
 */
export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        // WSL/CI sandbox is unavailable; the loaded extension is trusted local code.
        '--no-sandbox',
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // The background service worker's URL is chrome-extension://<id>/background.js.
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(worker.url().split('/')[2]);
  },
});

export const expect = test.expect;

/** Convenience: open the new-tab page for the loaded extension. */
export async function openNewTab(context: BrowserContext, extensionId: string) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/newtab.html`);
  return page;
}
