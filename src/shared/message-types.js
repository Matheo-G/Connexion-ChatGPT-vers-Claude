/**
 * @file Catalogue of every message exchanged between extension contexts
 * (service worker ⇄ content scripts ⇄ popup/options).
 *
 * Every message uses the same envelope:
 *   { type: MessageType, payload?: object, requestId?: string }
 * and every response:
 *   { ok: true, data?: any } | { ok: false, error: SerializedRouterError }
 *
 * Adding a message = adding a constant here + a handler in background/message-router.js.
 * Never use raw strings elsewhere in the code.
 */

/** @enum {string} */
export const MessageType = Object.freeze({
  // --- Handshake / lifecycle -------------------------------------------
  /** background → content: "are you alive?" */
  PING: 'core/ping',
  /** content → background: "my provider adapter is loaded and ready" */
  CONTENT_READY: 'core/content-ready',

  // --- Routing pipeline ------------------------------------------------
  /** content (source) | popup → background: start a routing job */
  ROUTE_REQUEST: 'pipeline/route-request',
  /** popup | pipeline → background: deliver a given text to a target AI */
  DELIVER_TEXT: 'pipeline/deliver-text',
  /** background → content (source): progress update for the UI */
  PIPELINE_STATUS: 'pipeline/status',

  // --- Provider operations ---------------------------------------------
  /** background → content (source): extract the latest content */
  SOURCE_EXTRACT: 'source/extract',
  /** background → content (target): insert text and optionally send it */
  TARGET_SUBMIT: 'target/submit',
  /** background → content (any): anonymous DOM skeleton for troubleshooting */
  PROVIDER_DIAGNOSE: 'provider/diagnose',

  // --- UI / diagnostics -------------------------------------------------
  /** popup → background: open or focus a target without sending (debug) */
  OPEN_TARGET: 'ui/open-target',
  /** popup → background: read the latest answer of a source AI (preview) */
  READ_SOURCE: 'ui/read-source',
  /** popup → background: anonymous diagnostic of a provider page */
  DIAGNOSE: 'ui/diagnose',
  /** popup → background: get current connection status */
  GET_STATUS: 'ui/get-status',
});

/** @enum {string} Steps reported through PIPELINE_STATUS, in order. */
export const PipelineStep = Object.freeze({
  EXTRACTING: 'extracting',
  TRANSFORMING: 'transforming',
  OPENING_TARGET: 'opening-target',
  SUBMITTING: 'submitting',
  DONE: 'done',
  FAILED: 'failed',
});

/**
 * @typedef {Object} Message
 * @property {MessageType} type
 * @property {Object} [payload]
 * @property {string} [requestId]  Correlates logs across contexts.
 */

/**
 * @typedef {Object} MessageResponse
 * @property {boolean} ok
 * @property {*} [data]
 * @property {import('./errors.js').SerializedRouterError} [error]
 */

const KNOWN_TYPES = new Set(Object.values(MessageType));

/**
 * Type guard used by routers to reject malformed or foreign messages.
 * @param {unknown} message
 * @returns {message is Message}
 */
export function isValidMessage(message) {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof message.type === 'string' &&
    KNOWN_TYPES.has(message.type)
  );
}
