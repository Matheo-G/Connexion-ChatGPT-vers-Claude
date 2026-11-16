/**
 * @file User preferences, stored in chrome.storage.sync (follows the user's
 * Chrome profile). Always merged over DEFAULT_SETTINGS so new options get a
 * sane value without any migration. Usable from every context.
 */

import { DEFAULT_SETTINGS, StorageKey } from '../shared/defaults.js';

/** @returns {Promise<import('../shared/defaults.js').Settings>} */
export async function getSettings() {
  const stored = (await chrome.storage.sync.get(StorageKey.SETTINGS))[StorageKey.SETTINGS];
  return { ...DEFAULT_SETTINGS, ...stored };
}

/**
 * @param {Partial<import('../shared/defaults.js').Settings>} patch
 * @returns {Promise<import('../shared/defaults.js').Settings>} The new settings.
 */
export async function updateSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.sync.set({ [StorageKey.SETTINGS]: next });
  return next;
}
