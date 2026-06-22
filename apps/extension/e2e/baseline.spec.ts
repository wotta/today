import { test, expect, openNewTab } from './fixtures';

// A baseline of core user journeys that must always work, exercised against the
// real built extension (offline path: IndexedDB cache, helper server blocked).
// Heavier than the smoke test on purpose — these are the flows a release should
// never break: the checklist, the item modal + rich description, and notes.

/** Add a task via the checklist's add row and return its text input locator. */
async function addTask(page: Awaited<ReturnType<typeof openNewTab>>, text: string) {
  const add = page.getByPlaceholder(/Add (your first task|a task)…/);
  await add.fill(text);
  await add.press('Enter');
  return page.locator('li input:not([type="checkbox"]):not([aria-label])').first();
}

test('adds a task and toggles it done', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);

  await addTask(page, 'ship the release');

  // The checklist row's checkbox is the first unlabelled checkbox in the list.
  const checkbox = page.locator('section').filter({ hasText: 'Check' }).locator('input[type="checkbox"]').first();
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await expect(checkbox).toBeChecked();
});

test('opens the item modal and edits the title', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);
  await addTask(page, 'rename me');

  await page.getByRole('button', { name: 'View "rename me"' }).click();

  const title = page.getByLabel('Title');
  await expect(title).toHaveValue('rename me');
  await title.fill('renamed task');
  await page.getByRole('button', { name: 'Close' }).click();

  // The checklist input reflects the edited title.
  await expect(
    page.locator('li input:not([type="checkbox"]):not([aria-label])').first(),
  ).toHaveValue('renamed task');
});

test('adds a rich description from the modal and shows it on reopen', async ({
  context,
  extensionId,
}) => {
  const page = await openNewTab(context, extensionId);
  await addTask(page, 'task with details');

  await page.getByRole('button', { name: 'View "task with details"' }).click();

  // Click the description box to enter edit mode, type into the BlockNote
  // editor, then commit with Save.
  await page.getByLabel('Description').click();
  const editor = page.locator('[contenteditable="true"]').last();
  await editor.click();
  await page.keyboard.type('remember the API key');
  await page.getByRole('button', { name: 'Save' }).click();

  // Close and reopen: the saved description renders in the read view.
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'View "task with details"' }).click();
  await expect(page.getByText('remember the API key')).toBeVisible();
});

test('writes a day note that survives a reload', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);

  // The page-corner ✎ opens the whole-day note (aria-label carries the date).
  await page.getByRole('button', { name: /^Open notes for \d{4}-\d{2}-\d{2}$/ }).click();

  const note = page.getByRole('textbox', { name: /^Notes for \d{4}-\d{2}-\d{2}$/ });
  await note.click();
  await page.keyboard.type('groceries and a gym session');
  await expect(note).toContainText('groceries and a gym session');

  await page.getByRole('button', { name: 'Back to planner' }).click();
  // Let the debounced save flush to IndexedDB before reloading.
  await page.waitForTimeout(600);
  await page.reload();

  await page.getByRole('button', { name: /^Open notes for \d{4}-\d{2}-\d{2}$/ }).click();
  await expect(
    page.getByRole('textbox', { name: /^Notes for \d{4}-\d{2}-\d{2}$/ }),
  ).toContainText('groceries and a gym session');
});

test('writes an hour note from an agenda row', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);

  // Each agenda hour has a ✎ that opens that hour's note page.
  await page.getByRole('button', { name: 'Open notes for 14:00' }).click();

  const note = page.getByRole('textbox', { name: /Notes for .* at 14:00$/ });
  await note.click();
  await page.keyboard.type('standup at the half hour');
  await expect(note).toContainText('standup at the half hour');

  await page.getByRole('button', { name: 'Back to planner' }).click();
  // Back on the planner, the 14:00 row's ✎ is now marked as having a note.
  await expect(page.getByRole('button', { name: 'Open notes for 14:00' })).toBeVisible();
});
