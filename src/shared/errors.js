/**
 * @file Single error type for the whole extension.
 *
 * Why a custom error?
 *  - Errors cross context boundaries (content ⇄ background) through
 *    chrome.runtime messaging, which only carries JSON. A plain Error loses
 *    its class and fields; RouterError serializes and rebuilds losslessly.
 *  - Each error has a stable `code` the UI maps to a friendly, translated
 *    message (see _locales/fr/messages.json → "error_<CODE>").
 */

import { t } from '../utils/i18n.js';

/** @enum {string} */
export const ErrorCode = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  TIMEOUT: 'TIMEOUT',
  MESSAGING_FAILED: 'MESSAGING_FAILED',

  // Source side (ChatGPT…)
  SOURCE_UNAVAILABLE: 'SOURCE_UNAVAILABLE',
  NO_CONTENT: 'NO_CONTENT',
  STILL_GENERATING: 'STILL_GENERATING',

  // Target side (Claude…)
  TARGET_UNAVAILABLE: 'TARGET_UNAVAILABLE',
  TARGET_NOT_LOGGED_IN: 'TARGET_NOT_LOGGED_IN',
  TARGET_RATE_LIMITED: 'TARGET_RATE_LIMITED',
  EDITOR_NOT_FOUND: 'EDITOR_NOT_FOUND',
  INSERT_FAILED: 'INSERT_FAILED',
  SEND_FAILED: 'SEND_FAILED',

  // Pipeline
  BUSY: 'BUSY',

  // Registries
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
});

const KNOWN_CODES = new Set(Object.values(ErrorCode));

/**
 * @typedef {Object} SerializedRouterError
 * @property {true} __routerError   Marker used by deserialize().
 * @property {ErrorCode} code
 * @property {string} message       Technical message (logs only).
 * @property {Object} [details]     Extra debug context (selectors tried, tab id…).
 */

export class RouterError extends Error {
  /**
   * @param {ErrorCode} code
   * @param {string} [message]  Technical message for logs; defaults to the code.
   * @param {Object} [details]  JSON-serializable debug context.
   */
  constructor(code, message, details) {
    super(message || code);
    this.name = 'RouterError';
    this.code = KNOWN_CODES.has(code) ? code : ErrorCode.UNKNOWN;
    this.details = details;
  }

  /** Friendly, translated message for the end user. */
  get userMessage() {
    return t(`error_${this.code}`) || t('error_UNKNOWN') || this.message;
  }

  /** @returns {SerializedRouterError} */
  toJSON() {
    return {
      __routerError: true,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }

  /**
   * Rebuilds a RouterError received through messaging.
   * @param {SerializedRouterError} data
   */
  static fromJSON(data) {
    return new RouterError(data?.code, data?.message, data?.details);
  }

  /**
   * Normalizes anything thrown into a RouterError so callers only ever
   * handle one shape. Already-normalized errors are returned untouched.
   * @param {unknown} error
   * @param {ErrorCode} [fallbackCode]
   */
  static from(error, fallbackCode = ErrorCode.UNKNOWN) {
    if (error instanceof RouterError) return error;
    if (error?.__routerError) return RouterError.fromJSON(error);
    const message = error instanceof Error ? error.message : String(error);
    return new RouterError(fallbackCode, message, { cause: error?.name });
  }
}
