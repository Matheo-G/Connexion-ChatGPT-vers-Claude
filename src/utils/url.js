/**
 * @file URL helpers, notably Chrome match patterns ("https://claude.ai/*")
 * so the same patterns serve tabs.query, the manifest and runtime detection.
 */

const patternCache = new Map();

/**
 * Converts a Chrome match pattern into a RegExp (scheme://host/path, `*` = anything).
 * @param {string} pattern
 * @returns {RegExp}
 */
function patternToRegExp(pattern) {
  if (!patternCache.has(pattern)) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    patternCache.set(pattern, new RegExp(`^${escaped}$`));
  }
  return patternCache.get(pattern);
}

/**
 * @param {string} url
 * @param {string[]} patterns
 * @returns {boolean}
 */
export function urlMatchesAny(url, patterns) {
  if (typeof url !== 'string') return false;
  return patterns.some((pattern) => patternToRegExp(pattern).test(url));
}

/**
 * True when both URLs point to the same origin + path (query/hash ignored).
 * Used to tell whether a tab already shows "new conversation".
 * @param {string} a
 * @param {string} b
 */
export function isSamePage(a, b) {
  try {
    const [x, y] = [new URL(a), new URL(b)];
    return x.origin === y.origin && trimSlash(x.pathname) === trimSlash(y.pathname);
  } catch {
    return false;
  }
}

const trimSlash = (path) => path.replace(/\/+$/, '') || '/';
