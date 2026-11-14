/**
 * @file Typed request/response bus on top of chrome.runtime messaging.
 *
 * Sending:
 *   const data = await sendToBackground(MessageType.GET_STATUS);
 *   const info = await sendToTab(tabId, MessageType.PING);
 *   → resolves with `data`, or throws a RouterError (rebuilt from the
 *     remote side, or MESSAGING_FAILED / TIMEOUT on transport problems).
 *
 * Receiving:
 *   chrome.runtime.onMessage.addListener(createMessageHandler({
 *     [MessageType.PING]: async (payload, sender) => ({ alive: true }),
 *   }));
 *   → handlers are plain async functions: return data or throw.
 *
 * Works in every context (service worker, content script, popup).
 */

import { RouterError, ErrorCode } from '../shared/errors.js';
import { isValidMessage } from '../shared/message-types.js';
import { Timeouts } from '../shared/defaults.js';
import { withTimeout } from '../utils/async.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('messaging');

/** Short id to correlate one request across the logs of several contexts. */
export function createRequestId() {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * @typedef {Object} SendOptions
 * @property {number} [timeout]    Defaults to Timeouts.MESSAGE.
 * @property {string} [requestId]  Reuse an existing id to chain logs.
 */

/**
 * @param {string} type
 * @param {Object} [payload]
 * @param {SendOptions} [options]
 */
export function sendToBackground(type, payload, options) {
  return dispatch((message) => chrome.runtime.sendMessage(message), type, payload, options);
}

/**
 * Sends to the top frame of a tab.
 * @param {number} tabId
 * @param {string} type
 * @param {Object} [payload]
 * @param {SendOptions} [options]
 */
export function sendToTab(tabId, type, payload, options) {
  return dispatch(
    (message) => chrome.tabs.sendMessage(tabId, message, { frameId: 0 }),
    type,
    payload,
    options,
  );
}

async function dispatch(send, type, payload = {}, options = {}) {
  const { timeout = Timeouts.MESSAGE, requestId = createRequestId() } = options;
  log.debug('→', type, requestId);
  try {
    const response = await withTimeout(send({ type, payload, requestId }), timeout, {
      message: `${type} got no answer within ${timeout} ms`,
    });
    return unwrap(response, type);
  } catch (error) {
    throw RouterError.from(error, ErrorCode.MESSAGING_FAILED);
  }
}

function unwrap(response, type) {
  if (!response || typeof response.ok !== 'boolean') {
    throw new RouterError(ErrorCode.MESSAGING_FAILED, `No handler answered ${type}`);
  }
  if (!response.ok) throw RouterError.from(response.error);
  return response.data;
}

/**
 * Builds a chrome.runtime.onMessage listener from a { type: handler } map.
 * Messages that are malformed, foreign (other extension / web page) or not
 * handled here are ignored, so several listeners can coexist.
 * @param {Record<string, (payload: Object, sender: chrome.runtime.MessageSender, message: Object) => any>} handlers
 */
export function createMessageHandler(handlers) {
  return (message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (!isValidMessage(message) || !Object.hasOwn(handlers, message.type)) return false;

    runHandler(handlers[message.type], message, sender).then(sendResponse);
    return true; // keep the channel open for the async response
  };
}

async function runHandler(handler, message, sender) {
  try {
    const data = await handler(message.payload ?? {}, sender, message);
    return { ok: true, data };
  } catch (error) {
    const routerError = RouterError.from(error);
    log.warn(`✗ ${message.type} [${message.requestId}]`, routerError.code, routerError.message);
    return { ok: false, error: routerError.toJSON() };
  }
}
