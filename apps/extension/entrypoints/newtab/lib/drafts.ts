import { browser } from 'wxt/browser';

/**
 * Per-item, uncommitted description drafts. While a description is being edited
 * the in-progress markdown is parked in extension-local storage keyed by the
 * check item's id, so it survives closing the dialog or the whole new-tab page.
 * It's cleared the moment the edit is committed (Save) or discarded (Cancel).
 */
const PREFIX = 'descDraft:';

export async function getDescriptionDraft(id: string): Promise<string | null> {
  const key = PREFIX + id;
  const stored = await browser.storage.local.get([key]);
  return typeof stored[key] === 'string' ? (stored[key] as string) : null;
}

export async function setDescriptionDraft(id: string, markdown: string): Promise<void> {
  await browser.storage.local.set({ [PREFIX + id]: markdown });
}

export async function clearDescriptionDraft(id: string): Promise<void> {
  await browser.storage.local.remove([PREFIX + id]);
}
