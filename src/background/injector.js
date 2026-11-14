/**
 * @file Guarantees a live content script in a tab.
 *
 * Declarative content scripts only reach pages loaded AFTER the extension
 * was installed/reloaded. Tabs opened before (very common) have none, or an
 * orphaned one. ensureContentScript() pings first and injects on demand;
 * the loader's guard makes a double injection harmless.
 */

import { MessageType } from '../shared/message-types.js';
import { RouterError, ErrorCode } from '../shared/errors.js';
import { Timeouts } from '../shared/defaults.js';
import { sendToTab } from '../services/messaging.js';
import { poll } from '../utils/async.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('injector');

const LOADER_FILE = 'src/content/loader.js';
const PING_TIMEOUT = 1_500;

/**
 * @param {number} tabId
 * @returns {Promise<Object | null>} The PING answer, or null if nobody answers.
 */
export async function pingTab(tabId) {
  try {
    return await sendToTab(tabId, MessageType.PING, {}, { timeout: PING_TIMEOUT });
  } catch {
    return null;
  }
}

/** @param {number} tabId */
export async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: [LOADER_FILE] });
    log.info('Content script injected', { tabId });
  } catch (error) {
    throw new RouterError(ErrorCode.TARGET_UNAVAILABLE, `Injection failed: ${error.message}`, {
      tabId,
    });
  }
}

/**
 * Resolves with the PING answer once the content runtime is ready.
 * @param {number} tabId
 * @param {{timeout?: number}} [options]
 */
export async function ensureContentScript(tabId, { timeout = Timeouts.CONTENT_READY } = {}) {
  const alive = await pingTab(tabId);
  if (alive) return alive;

  log.debug('No answer to PING, injecting', { tabId });
  await injectContentScript(tabId);
  return poll(() => pingTab(tabId), {
    interval: 250,
    timeout,
    code: ErrorCode.TARGET_UNAVAILABLE,
    message: `Content script not ready in tab ${tabId}`,
  });
}
