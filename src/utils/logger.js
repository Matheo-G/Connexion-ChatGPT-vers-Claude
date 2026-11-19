/**
 * @file Scoped logger shared by every context.
 *
 * Usage:
 *   const log = createLogger('tab-manager');
 *   log.info('Claude tab found', { tabId });
 *   log.debug('selector tried', sel);   // only printed in debug mode
 *
 * Output looks like:  [AI Router · tab-manager] Claude tab found {tabId: 42}
 *
 * Debug mode is driven by settings.debugMode in chrome.storage.sync and
 * propagates live to every context through storage.onChanged.
 * info/warn/error are always printed; debug only when enabled.
 */

import { StorageKey } from '../shared/defaults.js';

const PREFIX = 'AI Router';
const STYLE_SCOPE = 'color:#7c8cff;font-weight:600';
const STYLE_RESET = 'color:inherit;font-weight:normal';

let debugEnabled = false;
let initialized = false;

/**
 * Reads debug mode once and subscribes to changes. Idempotent; called lazily
 * by createLogger so modules never have to remember to initialize it.
 */
function initDebugFlag() {
  if (initialized) return;
  initialized = true;

  const storage = globalThis.chrome?.storage;
  if (!storage?.sync) return; // unit tests / non-extension context

  storage.sync
    .get(StorageKey.SETTINGS)
    .then((result) => {
      debugEnabled = Boolean(result?.[StorageKey.SETTINGS]?.debugMode);
    })
    .catch(() => {
      /* storage unavailable: keep defaults */
    });

  storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[StorageKey.SETTINGS]) return;
    debugEnabled = Boolean(changes[StorageKey.SETTINGS].newValue?.debugMode);
  });
}

/** Forces debug mode (tests, or temporary troubleshooting from DevTools). */
export function setDebug(enabled) {
  debugEnabled = Boolean(enabled);
}

/**
 * @param {string} scope  Module name shown in every line.
 * @returns {{debug: Function, info: Function, warn: Function, error: Function, time: Function}}
 */
export function createLogger(scope) {
  initDebugFlag();
  const tag = [`%c[${PREFIX} · ${scope}]%c`, STYLE_SCOPE, STYLE_RESET];

  return Object.freeze({
    debug: (...args) => {
      if (debugEnabled) console.debug(...tag, ...args);
    },
    info: (...args) => console.info(...tag, ...args),
    warn: (...args) => console.warn(...tag, ...args),
    error: (...args) => console.error(...tag, ...args),

    /**
     * Measures an async operation in debug mode.
     * @template T
     * @param {string} label
     * @param {() => Promise<T>} fn
     * @returns {Promise<T>}
     */
    async time(label, fn) {
      const start = performance.now();
      try {
        return await fn();
      } finally {
        if (debugEnabled) {
          const ms = Math.round(performance.now() - start);
          console.debug(...tag, `${label} — ${ms} ms`);
        }
      }
    },
  });
}
