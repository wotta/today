import { test, expect, openNewTab } from './fixtures';

// App chrome: theme toggle, data export/import, and the Connect-AI popover.

test('toggles between light and dark themes', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);
  const html = page.locator('html');

  await page.getByRole('button', { name: 'Dark mode' }).click();
  await expect(html).toHaveClass(/dark/);

  await page.getByRole('button', { name: 'Light mode' }).click();
  await expect(html).not.toHaveClass(/dark/);
});

test('exports the planner to a JSON download', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);

  const add = page.getByPlaceholder(/Add (your first task|a task)…/);
  await add.fill('something to export');
  await add.press('Enter');
  await page.waitForTimeout(600); // let it cache before exporting

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTitle('Export all days to JSON').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^today-export-\d{4}-\d{2}-\d{2}\.json$/);
});

test('imports days from a JSON file', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);

  const envelope = {
    version: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    days: {
      '2020-01-02': {
        date: '2020-01-02',
        checkItems: [{ id: 'x', text: 'imported task', done: false, order: 0 }],
        agenda: {},
      },
    },
  };

  await page.locator('input[type="file"]').setInputFiles({
    name: 'today-export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(envelope)),
  });

  await expect(page.getByText('Imported 1 day')).toBeVisible();
});

test('opens the Connect-AI popover with editor links', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);

  await page.getByRole('button', { name: 'Connect AI' }).click();

  const popover = page.locator('[aria-label="Connect an AI tool"]');
  await expect(popover).toBeVisible();
  await expect(popover.getByRole('link', { name: 'Add to Cursor' })).toHaveAttribute('href', /.+/);
  await expect(popover.getByRole('link', { name: 'Add to VS Code' })).toHaveAttribute('href', /.+/);
});
