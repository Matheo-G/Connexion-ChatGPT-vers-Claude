/**
 * @file The user's personal instructions per workflow ("always use our
 * design system", "answer in English"…), edited in the options page and
 * appended by each workflow to its prompt.
 *
 * Stored in chrome.storage.local (this browser): free texts can be long and
 * chrome.storage.sync limits each item to 8 KB.
 */

import { StorageKey } from '../shared/defaults.js';

export const NOTES_MAX_LENGTH = 2_000;

/** Keeps string values only, trimmed to the maximum length (pure). */
export function sanitizeNotes(raw) {
  const clean = {};
  if (!raw || typeof raw !== 'object') return clean;
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim()) clean[id] = value.slice(0, NOTES_MAX_LENGTH);
  }
  return clean;
}

/** @returns {Promise<Record<string, string>>} workflowId → notes */
export async function getWorkflowNotes() {
  return sanitizeNotes((await chrome.storage.local.get(StorageKey.WORKFLOW_NOTES))[StorageKey.WORKFLOW_NOTES]);
}

/** @param {string} workflowId @param {string} notes */
export async function setWorkflowNotes(workflowId, notes) {
  const all = await getWorkflowNotes();
  all[workflowId] = notes;
  await chrome.storage.local.set({ [StorageKey.WORKFLOW_NOTES]: sanitizeNotes(all) });
}
