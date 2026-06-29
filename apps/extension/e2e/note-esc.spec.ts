import { test, expect, openNewTab } from './fixtures';

// Leaving the note page with Esc, once the editor is no longer focused.

const openDayNote = /^Open notes for \d{4}-\d{2}-\d{2}$/;
const dayNote = /^Notes for \d{4}-\d{2}-\d{2}$/;

test('Esc blurs the focused editor, then a second Esc returns to the planner', async ({
  context,
  extensionId,
}) => {
  const page = await openNewTab(context, extensionId);

  await page.getByRole('button', { name: openDayNote }).click();
  const note = page.getByRole('textbox', { name: dayNote });
  // The editor autofocuses on mount.
  await expect(note).toBeFocused();

  // First Esc blurs the editor (existing shortcut) — still on the note page.
  await page.keyboard.press('Escape');
  await expect(note).not.toBeFocused();
  await expect(note).toBeVisible();

  // Second Esc, with nothing editable focused, leaves the page.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Check' })).toBeVisible();
  await expect(note).toHaveCount(0);
});

test('a single Esc returns to the planner when focus is already off the editor', async ({
  context,
  extensionId,
}) => {
  const page = await openNewTab(context, extensionId);

  await page.getByRole('button', { name: openDayNote }).click();
  const note = page.getByRole('textbox', { name: dayNote });
  await expect(note).toBeVisible();

  // Move focus off the editor by clicking the (non-editable) date heading.
  await page.getByRole('heading').first().click();
  await expect(note).not.toBeFocused();

  // A single Esc now leaves the page.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Check' })).toBeVisible();
  await expect(note).toHaveCount(0);
});
