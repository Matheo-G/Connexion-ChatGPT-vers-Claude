/**
 * @file The user's personal instructions per workflow ("always use our
 * design system", "answer in English"…), edited in the options page and
 * appended by each workflow to its prompt.
 *
 * Each workflow ships `defaultNotes`, used until the user edits the text.
 * Only the user's own versions are stored: an empty string is a deliberate
 * choice ("no instructions") and is kept, unlike a missing entry (= default).
 *
 * Stored in chrome.storage.local (this browser): free texts can be long and
 * chrome.storage.sync limits each item to 8 KB.
 */

import { StorageKey } from '../shared/defaults.js';

export const NOTES_MAX_LENGTH = 2_000;

/** Keeps string values only (empty ones too: "no instructions" is a choice), capped (pure). */
export function sanitizeNotes(raw) {
  const clean = {};
  if (!raw || typeof raw !== 'object') return clean;
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value === 'string') clean[id] = value.trim() ? value.slice(0, NOTES_MAX_LENGTH) : '';
  }
  return clean;
}

/**
 * The instructions that apply: the user's version if any, else the workflow's default (pure).
 * @param {import('../workflows/registry.js').Workflow} workflow
 * @param {Record<string, string>} stored
 */
export function effectiveNotes(workflow, stored) {
  return Object.hasOwn(stored, workflow.id) ? stored[workflow.id] : (workflow.defaultNotes ?? '');
}

/** Forgets the user's version: the default applies again. */
export async function resetWorkflowNotes(workflowId) {
  const all = await getWorkflowNotes();
  delete all[workflowId];
  await chrome.storage.local.set({ [StorageKey.WORKFLOW_NOTES]: all });
}

/** @returns {Promise<Record<string, string>>} workflowId → the user's own notes (overrides only) */
export async function getWorkflowNotes() {
  return sanitizeNotes((await chrome.storage.local.get(StorageKey.WORKFLOW_NOTES))[StorageKey.WORKFLOW_NOTES]);
}

/** @param {string} workflowId @param {string} notes */
export async function setWorkflowNotes(workflowId, notes) {
  const all = await getWorkflowNotes();
  all[workflowId] = notes;
  await chrome.storage.local.set({ [StorageKey.WORKFLOW_NOTES]: sanitizeNotes(all) });
}
