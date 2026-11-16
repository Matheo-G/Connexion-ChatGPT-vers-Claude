/**
 * @file Local history of routing jobs (chrome.storage.local, this browser only).
 *
 * Privacy: only a short preview of the sent text is kept (HISTORY_PREVIEW_LENGTH),
 * never the whole answer, and the user can disable or clear it in the options.
 */

import { HISTORY_LIMIT, HISTORY_PREVIEW_LENGTH, StorageKey } from '../shared/defaults.js';
import { normalizeText } from '../utils/text.js';

/**
 * @typedef {Object} HistoryEntry
 * @property {string} id
 * @property {number} at              Timestamp (ms).
 * @property {'sent' | 'inserted' | 'failed'} status
 * @property {string} sourceId
 * @property {string} targetId
 * @property {string} workflowId
 * @property {string} preview         First characters of the text, whitespace collapsed.
 * @property {number} length          Full text length.
 * @property {string} [targetUrl]     Conversation URL in the target AI, when known.
 * @property {string} [errorCode]
 */

/**
 * Builds a normalised entry (pure, unit-tested).
 * @param {Omit<HistoryEntry, 'preview' | 'length'> & {text?: string}} input
 * @returns {HistoryEntry}
 */
export function createEntry({ text = '', ...fields }) {
  const flat = normalizeText(text);
  const preview = flat.length > HISTORY_PREVIEW_LENGTH ? `${flat.slice(0, HISTORY_PREVIEW_LENGTH - 1)}…` : flat;
  return { ...fields, preview, length: text.length };
}

/**
 * Newest first, capped (pure, unit-tested).
 * @param {HistoryEntry[]} history
 * @param {HistoryEntry} entry
 */
export function prepend(history, entry) {
  return [entry, ...history].slice(0, HISTORY_LIMIT);
}

/** @returns {Promise<HistoryEntry[]>} */
export async function getHistory() {
  const stored = (await chrome.storage.local.get(StorageKey.HISTORY))[StorageKey.HISTORY];
  return Array.isArray(stored) ? stored : [];
}

/** Serialises writes so concurrent jobs never overwrite each other. */
let queue = Promise.resolve();

/** @param {HistoryEntry} entry */
export function addHistoryEntry(entry) {
  queue = queue
    .then(async () => {
      const next = prepend(await getHistory(), entry);
      await chrome.storage.local.set({ [StorageKey.HISTORY]: next });
    })
    .catch(() => {}); // history must never break a send
  return queue;
}

export async function clearHistory() {
  await chrome.storage.local.remove(StorageKey.HISTORY);
}

/**
 * @param {(history: HistoryEntry[]) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onHistoryChanged(callback) {
  const listener = (changes, area) => {
    if (area === 'local' && changes[StorageKey.HISTORY]) callback(changes[StorageKey.HISTORY].newValue ?? []);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
