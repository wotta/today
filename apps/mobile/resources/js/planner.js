// Alpine component backing the planner's Check list + Agenda. Hydrated from the
// server-rendered day; every mutation updates local state optimistically and
// (debounced) PUTs the whole DayEntry back — mirroring the extension's
// update(mutate) -> putDay(full entry) model.

function uuid() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : 'c-' + Math.random().toString(36).slice(2);
}

/** Always return a plain {hour: text} object, dropping empty/missing entries. */
function normalizeAgenda(input) {
    const out = {};
    if (input && typeof input === 'object') {
        for (const [hour, text] of Object.entries(input)) {
            if (text != null && String(text).trim() !== '') out[hour] = text;
        }
    }
    return out;
}

export function planner(initial) {
    return {
        date: initial.date,
        checkItems: initial.checkItems ?? [],
        // Coerce to a plain object: an empty PHP array serialises to a JS array,
        // and writing string keys to an array yields a sparse array (with nulls).
        agenda: normalizeAgenda(initial.agenda),
        draft: '',
        _timer: null,

        get sortedItems() {
            return [...this.checkItems].sort((a, b) => a.order - b.order);
        },

        addItem() {
            const text = this.draft.trim();
            if (!text) return;
            const order = this.checkItems.reduce((m, it) => Math.max(m, it.order), -1) + 1;
            this.checkItems.push({ id: uuid(), text, done: false, order });
            this.draft = '';
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

        remove(id) {
            this.checkItems = this.checkItems.filter((i) => i.id !== id);
            this.persist();
        },

        setAgenda(hour, text) {
            if (text.trim() === '') {
                delete this.agenda[hour];
            } else {
                this.agenda[hour] = text;
            }
            this.persist();
        },

        // Debounced so rapid typing collapses into one write.
        persist() {
            clearTimeout(this._timer);
            this._timer = setTimeout(() => this._save(), 400);
        },

        async _save() {
            const token = document.querySelector('meta[name="csrf-token"]')?.content ?? '';
            try {
                await fetch(`/api/day/${this.date}`, {
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
                    }),
                });
            } catch (e) {
                // Offline / transient — local state stays; a later edit retries.
            }
        },
    };
}
