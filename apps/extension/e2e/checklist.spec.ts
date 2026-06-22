import { test, expect, openNewTab, nativeDragAndDrop } from './fixtures';

// Checklist CRUD + reordering, against the real built extension.

const CHECK = (page: Awaited<ReturnType<typeof openNewTab>>) =>
  page.locator('section').filter({ hasText: 'Check' });

async function addTask(page: Awaited<ReturnType<typeof openNewTab>>, text: string) {
  const add = page.getByPlaceholder(/Add (your first task|a task)…/);
  await add.fill(text);
  await add.press('Enter');
}

/** All checklist task text inputs, top to bottom. */
const taskInputs = (page: Awaited<ReturnType<typeof openNewTab>>) =>
  page.locator('li input:not([type="checkbox"]):not([aria-label])');

test('edits a task title inline and keeps it across a reload', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);
  await addTask(page, 'draft title');

  const input = taskInputs(page).first();
  await input.fill('final title');
  await expect(input).toHaveValue('final title');

  await page.waitForTimeout(600); // debounced save
  await page.reload();
  await expect(taskInputs(page).first()).toHaveValue('final title');
});

test('deletes a task', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);
  await addTask(page, 'temporary');

  await page.getByRole('button', { name: 'Delete item' }).click();

  await expect(taskInputs(page)).toHaveCount(0);
  await expect(page.getByPlaceholder('Add your first task…')).toBeVisible();
});

test('reorders tasks by dragging one onto another', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);
  await addTask(page, 'first');
  await addTask(page, 'second');

  await expect(taskInputs(page).nth(0)).toHaveValue('first');

  const firstRow = taskInputs(page).nth(0).locator('xpath=ancestor::li[1]');
  const secondRow = taskInputs(page).nth(1).locator('xpath=ancestor::li[1]');
  await nativeDragAndDrop(page, firstRow, secondRow);

  // 'first' now occupies 'second's slot, so order flips.
  await expect(taskInputs(page).nth(0)).toHaveValue('second');
  await expect(taskInputs(page).nth(1)).toHaveValue('first');
});

test('closes the item modal with Escape and a backdrop click', async ({ context, extensionId }) => {
  const page = await openNewTab(context, extensionId);
  await addTask(page, 'modal task');

  const dialog = page.getByRole('dialog');

  // Escape closes.
  await page.getByRole('button', { name: 'View "modal task"' }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Backdrop click closes (mousedown on the overlay, outside the panel).
  await page.getByRole('button', { name: 'View "modal task"' }).click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(dialog).toBeHidden();
});
