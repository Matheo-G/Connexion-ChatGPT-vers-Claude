/**
 * @file Thin wrapper around chrome.i18n.
 *
 * All user-facing strings live in _locales/<lang>/messages.json.
 * Adding English later = adding _locales/en/messages.json, no code change.
 *
 * Safe to import outside the extension (unit tests): returns '' when
 * chrome.i18n is unavailable so callers can apply their own fallback.
 */

/**
 * @param {string} key          Message key from messages.json.
 * @param {string|string[]} [substitutions]
 * @returns {string} Translated string, or '' if unknown.
 */
export function t(key, substitutions) {
  try {
    return globalThis.chrome?.i18n?.getMessage(key, substitutions) ?? '';
  } catch {
    return '';
  }
}

/**
 * Replaces the text of every element carrying `data-i18n="key"`.
 * Used by popup/options HTML so markup stays free of hardcoded copy.
 * @param {ParentNode} [root=document]
 */
export function localizeDocument(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const text = t(el.dataset.i18n);
    if (text) el.textContent = text;
  }
}
