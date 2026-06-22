import { test, expect } from './fixtures';

// The options page settings that work offline: the reminders toggle and the
// agenda drop-granularity select both persist to chrome.storage.local.

const optionsUrl = (extensionId: string) => `chrome-extension://${extensionId}/options.html`;

test('persists the reminders toggle', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(optionsUrl(extensionId));

  const reminders = page.getByLabel('Notify me before scheduled items');
  await expect(reminders).toBeChecked(); // defaults on
  await reminders.uncheck();
  await page.waitForTimeout(200);

  await page.reload();
  await expect(page.getByLabel('Notify me before scheduled items')).not.toBeChecked();
});

test('persists the agenda drop granularity', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(optionsUrl(extensionId));

  const granularity = page.getByRole('combobox');
  await expect(granularity).toHaveValue('60'); // defaults on-the-hour
  await granularity.selectOption('15');
  await page.waitForTimeout(200);

  await page.reload();
  await expect(page.getByRole('combobox')).toHaveValue('15');
});
