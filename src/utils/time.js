/**
 * @file Human-friendly dates ("il y a 3 min"), in the browser's UI language.
 */

const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/**
 * @param {number} timestamp  ms
 * @param {{now?: number, locale?: string}} [options]
 * @returns {string} e.g. "il y a 3 minutes", "à l'instant"
 */
export function formatRelative(timestamp, { now = Date.now(), locale = 'fr' } = {}) {
  const seconds = Math.round((timestamp - now) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, 'second'); // "maintenant"
}
