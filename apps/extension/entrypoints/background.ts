import * as backend from './newtab/lib/backend';
import { getDay as getCached } from './newtab/lib/db';
import { hourLabel } from './newtab/lib/date';
import {
  itemsDueForSlot,
  reminderKey,
  upcomingSlot,
} from './newtab/lib/reminders';
import { getRemindersEnabled } from './newtab/lib/settings';
import type { DayEntry } from '@today/types';

const REMINDER_ALARM = 'slot-reminders';
const NOTIFIED_KEY = 'notifiedSlots';

export default defineBackground(() => {
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'open-today',
      title: 'Open Today',
      contexts: ['action'],
    });
    void browser.alarms.create(REMINDER_ALARM, { periodInMinutes: 1 });
  });

  // onInstalled only fires on install/update; re-arm after a browser restart.
  browser.runtime.onStartup.addListener(() => {
    void browser.alarms.create(REMINDER_ALARM, { periodInMinutes: 1 });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'open-today' && tab?.windowId != null) {
      browser.sidePanel.open({ windowId: tab.windowId });
    }
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === REMINDER_ALARM) void checkUpcomingSlot();
  });

  browser.notifications.onClicked.addListener((id) => {
    void browser.notifications.clear(id);
    // The extension owns the new-tab page, so a bare tab opens the planner.
    void browser.tabs.create({});
  });
});

/**
 * Runs every minute. When an agenda slot starts within the lead window and has
 * unfinished pinned items, fire one notification for the whole slot. Checking
 * on a timer (instead of scheduling one alarm per item) means edits from the
 * UI, other devices, or MCP tools never leave stale alarms behind.
 */
async function checkUpcomingSlot(): Promise<void> {
  if (!(await getRemindersEnabled())) return;

  const upcoming = upcomingSlot(new Date());
  if (!upcoming) return;

  const key = reminderKey(upcoming);
  if (await alreadyNotified(key)) return;

  const entry = await loadDay(upcoming.dateKey);
  const items = itemsDueForSlot(entry, upcoming.slot);
  // No items: leave the key unmarked so one pinned later in the window still notifies.
  if (items.length === 0) return;

  await markNotified(key);
  await browser.notifications.create(`slot-${key}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: `In ${upcoming.minutesUntil} min — ${hourLabel(upcoming.slot)}`,
    message: items.map((item) => item.text).join('\n'),
  });
}

/** Same read order as the UI: active backend first, IndexedDB cache as fallback. */
async function loadDay(dateKey: string): Promise<DayEntry> {
  try {
    return await backend.fetchDay(dateKey);
  } catch {
    return getCached(dateKey);
  }
}

// Fired-slot keys live in session storage (cleared on browser restart, which is
// fine — restarting can't re-fire a past slot). Firefox < 115 lacks
// storage.session, hence the local fallback.
function notifiedStore() {
  return browser.storage.session ?? browser.storage.local;
}

async function alreadyNotified(key: string): Promise<boolean> {
  const stored = await notifiedStore().get(NOTIFIED_KEY);
  const keys = (stored[NOTIFIED_KEY] as string[] | undefined) ?? [];
  return keys.includes(key);
}

async function markNotified(key: string): Promise<void> {
  const stored = await notifiedStore().get(NOTIFIED_KEY);
  // Only the current slot's key matters for dedup; a short tail is plenty.
  const keys = ((stored[NOTIFIED_KEY] as string[] | undefined) ?? []).slice(-7);
  keys.push(key);
  await notifiedStore().set({ [NOTIFIED_KEY]: keys });
}
