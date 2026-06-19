/**
 * Dev-only feature flags (constants for now, an Options toggle later if kept).
 *
 * PER_SLOT_NOTES gates the per-hour note affordance on agenda rows — turning
 * it off leaves only the per-day note ("variant A" of the rich-notes design;
 * see docs/superpowers/specs/2026-06-09-rich-notes-design.md).
 */
export const PER_SLOT_NOTES = true;
