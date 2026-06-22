import { test, expect, openNewTab, nativeDragAndDrop } from './fixtures';

// Agenda interactions: per-hour free text, and the pinned-chip lifecycle
// (pin, re-pin, unpin, toggle, view) — against the real built extension.

async function addTask(page: Awaited<ReturnType<typeof openNewTab>>, text: string) {
  const add = page.getByPlaceholder(/Add (your first task|a task)…/);
  await add.fill(text);
  await add.press('Enter');
}

/** The agenda row (li) for a labelled hour, e.g. "14:00". */
const agendaRow = (page: Awaited<ReturnType<typeof openNewTab>>, label: string) =>
  page.getByLabel(`Agenda at ${label}`).locator('xpath=ancestor::li[1]');

/** Add a task and drag it onto an agenda hour to pin it. */
async function pinTaskToHour(
  page: Awaited<ReturnType<typeof openNewTab>>,
  text: string,
  hourLabel: string,
) {
  await addTask(page, text);
  const sourceRow = page
    .locator('li input:not([type="checkbox"]):not([aria-label])')
    .first()
    .locator('xpath=ancestor::li[1]');
  await nativeDragAndDrop(page, sourceRow, agendaRow(page, hourLabel));
}

test('types per-hour agenda text that survives a reload', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);

  const slot = page.getByLabel('Agenda at 14:00');
  await slot.fill('lunch with Sam');
  await expect(slot).toHaveValue('lunch with Sam');

  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByLabel('Agenda at 14:00')).toHaveValue('lunch with Sam');
});

test('pins a task to an hour and shows it as a chip there', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);
  await pinTaskToHour(page, 'call the bank', '14:00');

  await expect(agendaRow(page, '14:00').getByText('call the bank')).toBeVisible();
});

test('re-pins a chip by dragging it to another hour', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);
  await pinTaskToHour(page, 'move me', '14:00');

  const chip = page.getByLabel('Toggle "move me"').locator('xpath=ancestor::span[1]');
  await nativeDragAndDrop(page, chip, agendaRow(page, '16:00'));

  await expect(agendaRow(page, '16:00').getByText('move me')).toBeVisible();
  await expect(agendaRow(page, '14:00').getByText('move me')).toHaveCount(0);
});

test('toggles a chip done from the agenda', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);
  await pinTaskToHour(page, 'tick me', '14:00');

  const chipCheckbox = page.getByLabel('Toggle "tick me"');
  await expect(chipCheckbox).not.toBeChecked();
  await chipCheckbox.check();
  await expect(chipCheckbox).toBeChecked();
});

test('unpins a chip from the agenda', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);
  await pinTaskToHour(page, 'unpin me', '14:00');

  await page.getByLabel('Unpin "unpin me"').click();

  // Gone from the agenda, still present in the checklist.
  await expect(agendaRow(page, '14:00').getByText('unpin me')).toHaveCount(0);
  await expect(
    page.locator('li input:not([type="checkbox"]):not([aria-label])').first(),
  ).toHaveValue('unpin me');
});

test('opens the item dialog from an agenda chip', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);
  await pinTaskToHour(page, 'inspect me', '14:00');

  // Both the checklist row and the agenda chip expose a View button; use the chip's.
  await agendaRow(page, '14:00').getByRole('button', { name: 'View "inspect me"' }).click();

  await expect(page.getByLabel('Title')).toHaveValue('inspect me');
  await expect(page.getByText('Pinned to 14:00')).toBeVisible();
});
