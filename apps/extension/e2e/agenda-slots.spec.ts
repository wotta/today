import { test, expect, openNewTab, nativeDragAndDrop } from './fixtures';

// Exercises the opt-in sub-hour drop granularity (Options → Agenda). With the
// agenda split into 30-minute bands, dropping a checklist item on the lower
// half of an hour row pins it to :30, and the checklist badge reflects it.
//
// The chips use native HTML5 drag-and-drop with a dataTransfer payload, which
// Playwright's mouse-based dragTo() does not drive. We dispatch the DnD events
// ourselves, sharing one DataTransfer between source and target so the drop
// handler reads the id the dragstart handler wrote — and pass a clientY in the
// row's lower half so slotFromEvent() resolves to hour + 0.5.

async function setGranularity(
  context: Parameters<typeof openNewTab>[0],
  extensionId: string,
  minutes: '60' | '30' | '15',
) {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByRole('combobox').selectOption(minutes);
  // The setter is fire-and-forget into chrome.storage.local; give it a beat to
  // flush before the new-tab page reads it on mount.
  await options.waitForTimeout(300);
  await options.close();
}

/** Drop the checklist task onto the given fraction (0–1) down an agenda hour. */
async function dropTaskOnHour(
  page: Awaited<ReturnType<typeof openNewTab>>,
  hourLabel: string,
  fractionDown: number,
) {
  const sourceRow = page
    .locator('li input:not([type="checkbox"]):not([aria-label])')
    .first()
    .locator('xpath=ancestor::li[1]');
  const targetRow = page.getByLabel(`Agenda at ${hourLabel}`).locator('xpath=ancestor::li[1]');
  await nativeDragAndDrop(page, sourceRow, targetRow, fractionDown);
}

test('pins a dragged item to the half-hour when 30-min slots are on', async ({
  context,
  extensionId,
}) => {
  await setGranularity(context, extensionId, '30');
  const page = await openNewTab(context, extensionId);

  const add = page.getByPlaceholder(/Add (your first task|a task)…/);
  await add.fill('half-hour task');
  await add.press('Enter');

  // Lower half of the 14:00 row -> 14:30.
  await dropTaskOnHour(page, '14:00', 0.75);

  // The checklist row's pinned-slot badge reflects the half-hour.
  await expect(page.getByTitle('Pinned to the agenda')).toHaveText('14:30');
});

test('pins to the quarter-hour at 15-min granularity', async ({ context, extensionId }) => {
  await setGranularity(context, extensionId, '15');
  const page = await openNewTab(context, extensionId);

  const add = page.getByPlaceholder(/Add (your first task|a task)…/);
  await add.fill('quarter-hour task');
  await add.press('Enter');

  // ~0.3 down the 14:00 row -> the second of four bands -> 14:15.
  await dropTaskOnHour(page, '14:00', 0.3);

  await expect(page.getByTitle('Pinned to the agenda')).toHaveText('14:15');
});

test('still pins on the hour when granularity is on-the-hour', async ({
  context,
  extensionId,
}) => {
  await setGranularity(context, extensionId, '60');
  const page = await openNewTab(context, extensionId);

  const add = page.getByPlaceholder(/Add (your first task|a task)…/);
  await add.fill('on-the-hour task');
  await add.press('Enter');

  // Even dropping low in the row pins to the whole hour with no sub-bands.
  await dropTaskOnHour(page, '14:00', 0.75);

  await expect(page.getByTitle('Pinned to the agenda')).toHaveText('14:00');
});
