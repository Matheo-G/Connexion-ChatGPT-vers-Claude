/**
 * @file User preferences, stored in chrome.storage.sync (follows the user's
 * Chrome profile). Always sanitised and merged over DEFAULT_SETTINGS, so new
 * options get a sane value and corrupted values can never reach the code.
 * Usable from every context.
 */

import { DEFAULT_SETTINGS, SETTING_CHOICES, StorageKey } from '../shared/defaults.js';
import { listProviders } from '../providers/registry.js';
import { listWorkflows } from '../workflows/registry.js';

/**
 * Settings whose value must be an id known to a registry: a value from a
 * removed workflow or a source-only AI would otherwise break every send.
 */
const REGISTRY_CHOICES = {
  defaultTarget: () => listProviders().filter((p) => p.roles.includes('target')).map((p) => p.id),
  defaultWorkflow: () => listWorkflows().map((w) => w.id),
};

/**
 * Keeps only known keys whose value has the default's type (and an allowed
 * value for enumerated settings or registry ids); everything else falls back
 * to the default.
 * @param {unknown} raw
 * @returns {import('../shared/defaults.js').Settings}
 */
export function sanitizeSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const clean = { ...DEFAULT_SETTINGS };
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    const value = source[key];
    if (typeof value !== typeof fallback) continue;
    if (SETTING_CHOICES[key] && !SETTING_CHOICES[key].includes(value)) continue;
    if (REGISTRY_CHOICES[key] && !REGISTRY_CHOICES[key]().includes(value)) continue;
    clean[key] = value;
  }
  return clean;
}

/** @returns {Promise<import('../shared/defaults.js').Settings>} */
export async function getSettings() {
  const stored = (await chrome.storage.sync.get(StorageKey.SETTINGS))[StorageKey.SETTINGS];
  return sanitizeSettings(stored);
}

/**
 * @param {Partial<import('../shared/defaults.js').Settings>} patch
 * @returns {Promise<import('../shared/defaults.js').Settings>} The new settings.
 */
export async function updateSettings(patch) {
  const next = sanitizeSettings({ ...(await getSettings()), ...patch });
  await chrome.storage.sync.set({ [StorageKey.SETTINGS]: next });
  return next;
}

/** Restores every default. */
export async function resetSettings() {
  await chrome.storage.sync.set({ [StorageKey.SETTINGS]: { ...DEFAULT_SETTINGS } });
  return { ...DEFAULT_SETTINGS };
}

/**
 * Calls `callback` with the new settings whenever they change (any context).
 * @param {(settings: import('../shared/defaults.js').Settings) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onSettingsChanged(callback) {
  const listener = (changes, area) => {
    if (area === 'sync' && changes[StorageKey.SETTINGS]) {
      callback(sanitizeSettings(changes[StorageKey.SETTINGS].newValue));
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
