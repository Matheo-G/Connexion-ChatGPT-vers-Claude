/**
 * @file Pure text helpers (usable in every context, including the service worker).
 */

/** Collapses whitespace so texts can be compared regardless of formatting. */
export function normalizeText(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** @returns {boolean} true when the text has visible characters. */
export function hasText(text) {
  return normalizeText(text).length > 0;
}

/**
 * Short fingerprint of a text, robust to Markdown rendering: rich editors
 * may turn "**bold**" into bold text, so markup characters are ignored.
 * @param {string} text
 * @param {number} [length=40]
 */
export function fingerprint(text, length = 40) {
  return normalizeText(String(text ?? '').replace(/[#*_`>~|\\-]/g, ' ')).slice(0, length);
}
