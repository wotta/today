import { test, expect, openNewTab } from './fixtures';

// Date navigation: header buttons, the weekday strip, keyboard shortcuts, and
// the fact that each day keeps its own data.

/** The planner's current date key (YYYY-MM-DD), read from the page-corner ✎. */
async function currentDateKey(page: Awaited<ReturnType<typeof openNewTab>>): Promise<string> {
  const btn = page.getByRole('button', { name: /^Open notes for \d{4}-\d{2}-\d{2}$/ });
  const label = await btn.getAttribute('aria-label');
  return label!.replace('Open notes for ', '');
}

test('moves between days with the header buttons and back to today', async ({
  context,
  extensionId,
}) => {
  const page = await openNewTab(context, extensionId);
  const today = await currentDateKey(page);

  await page.getByRole('button', { name: 'Next day' }).click();
  // YYYY-MM-DD sorts chronologically as a string.
  expect(await currentDateKey(page) > today).toBe(true);

  await page.getByRole('button', { name: 'Previous day' }).click();
  await page.getByRole('button', { name: 'Previous day' }).click();
  expect(await currentDateKey(page) < today).toBe(true);

  // The "t" shortcut jumps back to today (focus is on a button, not a field).
  await page.keyboard.press('t');
  expect(await currentDateKey(page)).toBe(today);
});

test('navigates with arrow-key shortcuts', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);
  const today = await currentDateKey(page);

  // The add-task input autofocuses; arrow shortcuts are suppressed in fields, so
  // blur it by clicking a non-interactive element first.
  await page.getByRole('heading', { name: 'Agenda' }).click();

  await page.keyboard.press('ArrowRight');
  expect(await currentDateKey(page) > today).toBe(true);

  await page.keyboard.press('ArrowLeft');
  expect(await currentDateKey(page)).toBe(today);

  // Shift+Arrow jumps a whole week.
  await page.keyboard.press('Shift+ArrowRight');
  const wk = await currentDateKey(page);
  const days = (new Date(wk + 'T00:00').getTime() - new Date(today + 'T00:00').getTime()) / 86_400_000;
  expect(days).toBe(7);
});

test('jumps to a weekday via the weekday strip', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);

  await page.getByRole('button', { name: 'Go to Monday this week' }).click();

  const key = await currentDateKey(page);
  expect(new Date(key + 'T00:00').getDay()).toBe(1); // Monday
});

test('keeps separate data per day', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);

  await page.getByLabel('Agenda at 14:00').fill('today only');
  await page.waitForTimeout(600);

  await page.getByRole('button', { name: 'Next day' }).click();
  await expect(page.getByLabel('Agenda at 14:00')).toHaveValue('');

  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(page.getByLabel('Agenda at 14:00')).toHaveValue('today only');
});
