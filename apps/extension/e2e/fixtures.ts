import { test as base, chromium, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
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
 * Chromium. Each test gets its own freshly-created userDataDir (removed on
 * close) so IndexedDB / chrome.storage never bleed between tests — passing an
 * empty string was observed to reuse profile data across runs.
 */
export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'today-e2e-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        // WSL/CI sandbox is unavailable; the loaded extension is trusted local code.
        '--no-sandbox',
      ],
    });
    // Force the offline path: never reach the local helper server. This keeps
    // tests deterministic and — critically — stops them reading or writing the
    // user's real planner data if a dev server happens to be running.
    await context.route(/(127\.0\.0\.1|localhost):8765/, (route) => route.abort());
    await use(context);
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },
  extensionId: async ({ context }, use) => {
    // The background service worker's URL is chrome-extension://<id>/background.js.
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(worker.url().split('/')[2]);
  },
});

export const expect = test.expect;

/**
 * Open the new-tab page for the loaded extension. The context blocks the helper
 * server and uses a fresh profile, so each test starts from an empty planner.
 */
export async function openNewTab(context: BrowserContext, extensionId: string) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/newtab.html`);
  // Wait for React to mount AND for the initial day-load to settle. The load's
  // fallback does a late setEntry() that would otherwise clobber an edit made
  // too early; networkidle lands after the (blocked) server calls resolve.
  await page.getByRole('heading', { name: 'Check' }).waitFor();
  await page.waitForLoadState('networkidle');
  return page;
}
