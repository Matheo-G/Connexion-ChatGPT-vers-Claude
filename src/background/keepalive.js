/**
 * @file Keeps the MV3 service worker alive during a long job.
 *
 * Chrome may stop an idle service worker after ~30 s. A routing job mostly
 * waits (page load, editor hydration) and could be cut in the middle.
 * Calling a trivial extension API periodically resets the idle timer —
 * the approach Chrome documents for work under 5 minutes.
 */

const PING_INTERVAL = 20_000;

/**
 * Runs `task` while keeping the service worker alive.
 * @template T
 * @param {() => Promise<T>} task
 * @param {{interval?: number}} [options]
 * @returns {Promise<T>}
 */
export async function withKeepAlive(task, { interval = PING_INTERVAL } = {}) {
  const timer = setInterval(() => {
    chrome.runtime.getPlatformInfo().catch(() => {});
  }, interval);
  try {
    return await task();
  } finally {
    clearInterval(timer);
  }
}
