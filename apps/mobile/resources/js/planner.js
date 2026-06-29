// Alpine component backing the planner's Check list + Agenda. Hydrated from the
// server-rendered day; every mutation updates local state optimistically and
// (debounced) PUTs the whole DayEntry back — mirroring the extension's
// update(mutate) -> putDay(full entry) model.

function uuid() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : 'c-' + Math.random().toString(36).slice(2);
}

const START_SLOT = 6;
const END_SLOT = 26;
const SLOT_STEP = 0.25;
const SLOT_COUNT = Math.round((END_SLOT - START_SLOT) / SLOT_STEP) + 1;

function slotKey(slot) {
    const value = Math.round(Number(slot) / SLOT_STEP) * SLOT_STEP;
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function slotLabel(slot) {
    const hour = Math.floor(slot);
    const displayHour = hour > 24 ? hour - 24 : hour;
    const minutes = Math.round((slot - hour) * 60);

    return `${displayHour}:${String(minutes).padStart(2, '0')}`;
}

function normalizeSlot(slot) {
    const value = Number(slot);
    if (!Number.isFinite(value)) return null;
    if (value < START_SLOT || value > END_SLOT) return null;
    const rounded = Math.round(value / SLOT_STEP) * SLOT_STEP;
    if (Math.abs(value - rounded) > 0.00001) return null;

    return Number(slotKey(rounded));
}

/** Always return a plain {slot: text} object, dropping empty/missing entries. */
function normalizeAgenda(input) {
    const out = {};
    if (input && typeof input === 'object') {
        for (const [slot, text] of Object.entries(input)) {
            const normalized = normalizeSlot(slot);
            if (normalized === null) continue;
            const key = slotKey(normalized);
            if (text != null && String(text).trim() !== '') out[key] = text;
        }
    }
    return out;
}

/** Same wire shape as agenda: a plain object keyed by agenda slot. */
function normalizeSlotNotes(input) {
    return normalizeAgenda(input);
}

export function planner(initial) {
    return {
        date: initial.date,
        checkItems: (initial.checkItems ?? []).map((item) => ({
            ...item,
            slot: item.slot == null ? null : normalizeSlot(item.slot),
        })),
        // Coerce to a plain object: an empty PHP array serialises to a JS array,
        // and writing string keys to an array yields a sparse array (with nulls).
        agenda: normalizeAgenda(initial.agenda),
        note: initial.note ?? null,
        slotNotes: normalizeSlotNotes(initial.slotNotes),
        currentHour: initial.currentHour ?? null,
        draft: '',
        openItemId: null,
        _timer: null,
        syncStatus: 'idle',
        syncMessage: 'Ready',
        // True while a local edit is pending/unsaved — a remote sync must not
        // overwrite this panel's fields mid-edit.
        dirty: false,

        get slots() {
            return Array.from({ length: SLOT_COUNT }, (_, index) => {
                const value = Number(slotKey(START_SLOT + index * SLOT_STEP));
                return {
                    value,
                    key: slotKey(value),
                    label: slotLabel(value),
                    minuteLabel: value % 1 === 0 ? '' : `:${String(Math.round((value % 1) * 60)).padStart(2, '0')}`,
                    isHour: value % 1 === 0,
                    isEvenHour: value % 2 === 0,
                };
            });
        },

        get sortedItems() {
            return [...this.checkItems].sort((a, b) => a.order - b.order);
        },

        get openItem() {
            return this.checkItems.find((item) => item.id === this.openItemId) ?? null;
        },

        addItem() {
            const text = this.draft.trim();
            if (!text) return;
            const order = this.checkItems.reduce((m, it) => Math.max(m, it.order), -1) + 1;
            const id = uuid();
            this.checkItems.push({ id, text, done: false, order });
            this.draft = '';
            this.openItemId = id;
            this.persist();
        },

        toggle(id) {
            const it = this.checkItems.find((i) => i.id === id);
            if (it) {
                it.done = !it.done;
                this.persist();
            }
        },

        editText(id, text) {
            const it = this.checkItems.find((i) => i.id === id);
            if (it) {
                it.text = text;
                this.persist();
            }
        },

        editDescription(id, description) {
            const it = this.checkItems.find((i) => i.id === id);
            if (it) {
                it.description = description.trim() === '' ? null : description;
                this.persist();
            }
        },

        moveItem(id, direction) {
            const ordered = this.sortedItems;
            const index = ordered.findIndex((item) => item.id === id);
            const nextIndex = index + direction;
            if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;

            [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
            ordered.forEach((item, order) => {
                item.order = order;
            });
            this.persist();
        },

        remove(id) {
            this.checkItems = this.checkItems.filter((i) => i.id !== id);
            if (this.openItemId === id) this.openItemId = null;
            this.persist();
        },

        openDetails(id) {
            this.openItemId = id;
        },

        closeDetails() {
            this.openItemId = null;
        },

        pinToSlot(id, slot) {
            const it = this.checkItems.find((i) => i.id === id);
            const normalized = normalizeSlot(slot);
            if (it && normalized !== null) {
                it.slot = normalized;
                this.persist();
            }
        },

        unpin(id) {
            const it = this.checkItems.find((i) => i.id === id);
            if (it) {
                it.slot = null;
                this.persist();
            }
        },

        pinnedItems(slot) {
            const normalized = normalizeSlot(slot);
            if (normalized === null) return [];
            return this.sortedItems.filter((item) => item.slot === normalized);
        },

        setAgenda(slot, text) {
            const key = slotKey(slot);
            if (text.trim() === '') {
                delete this.agenda[key];
            } else {
                this.agenda[key] = text;
            }
            this.persist();
        },

        applySyncStatus(detail) {
            this.syncStatus = detail?.kind ?? 'idle';
            this.syncMessage = detail?.message ?? 'Ready';
        },

        syncStatusClass() {
            return {
                syncing: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700/60 dark:bg-sky-400/10 dark:text-sky-300',
                synced: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-400/10 dark:text-emerald-300',
                saved: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-400/10 dark:text-amber-300',
                error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-700/60 dark:bg-red-400/10 dark:text-red-300',
            }[this.syncStatus] ?? 'border-stone-200 bg-stone-50 text-stone-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400';
        },

        setNote(text) {
            this.note = text.trim() === '' ? null : text;
            this.persist();
        },

        setSlotNote(slot, text) {
            const key = slotKey(slot);
            if (text.trim() === '') {
                delete this.slotNotes[key];
            } else {
                this.slotNotes[key] = text;
            }
            this.persist();
        },

        hasSlotNote(slot) {
            return (this.slotNotes[slotKey(slot)] ?? '').trim() !== '';
        },

        isCurrentSlot(slot) {
            return this.currentHour != null && Math.floor(Number(slot)) === this.currentHour;
        },

        slotLabel,


        // Debounced so rapid typing collapses into one write.
        persist() {
            this.dirty = true;
            this.applySyncStatus({ kind: 'syncing', message: 'Saving...' });
            clearTimeout(this._timer);
            this._timer = setTimeout(() => this._save(), 400);
        },

        async _save() {
            const token = document.querySelector('meta[name="csrf-token"]')?.content ?? '';
            try {
                const res = await fetch(`/api/day/${this.date}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': token,
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        date: this.date,
                        checkItems: this.checkItems,
                        agenda: this.agenda,
                        note: this.note,
                        slotNotes: this.slotNotes,
                    }),
                });
                if (!res.ok) throw new Error('Save failed');
                const data = await res.json();
                this.dirty = false;
                const status = data.synced
                    ? { kind: 'synced', message: 'Synced' }
                    : { kind: 'saved', message: 'Saved locally' };
                this.applySyncStatus(status);
                window.dispatchEvent(new CustomEvent('today:sync-status', { detail: status }));
            } catch (e) {
                // Offline / transient — local state stays dirty; a later edit retries.
                this.applySyncStatus({ kind: 'error', message: 'Save failed' });
            }
        },

        // Apply a pulled remote change for THIS panel's date. Skipped while the
        // panel is dirty so an in-flight local edit is never clobbered — the
        // local store already holds the remote value, so a later navigation
        // surfaces it.
        applySync(detail) {
            const entry = detail?.days?.[this.date];
            if (!entry || this.dirty) return;
            this.checkItems = (entry.checkItems ?? []).map((item) => ({
                ...item,
                slot: item.slot == null ? null : normalizeSlot(item.slot),
            }));
            this.agenda = normalizeAgenda(entry.agenda);
            this.note = entry.note ?? null;
            this.slotNotes = normalizeSlotNotes(entry.slotNotes);
        },
    };
}
