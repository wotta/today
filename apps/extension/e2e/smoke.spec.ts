import { test, expect, openNewTab } from './fixtures';

// These run with no helper server, so the app exercises its offline path:
// reads fall back to IndexedDB and writes are cached locally. That's enough to
// prove the harness works and that the real UI renders and persists.

test('renders the planner shell', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);

  await expect(page.getByRole('heading', { name: 'Check' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
});

test('adds a task and keeps it across a reload', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);

  const add = page.getByPlaceholder(/Add (your first task|a task)…/);
  await add.fill('write the playwright harness');
  await add.press('Enter');

  // The check item's text input is the one with no aria-label (agenda hours have
  // those) and no placeholder (the add row has that).
  const taskInput = page.locator('li input:not([type="checkbox"]):not([aria-label])');
  await expect(taskInput).toHaveValue('write the playwright harness');

  // Let the 300ms debounced save flush to IndexedDB before reloading.
  await page.waitForTimeout(600);
  await page.reload();

  await expect(taskInput).toHaveValue('write the playwright harness');
});
