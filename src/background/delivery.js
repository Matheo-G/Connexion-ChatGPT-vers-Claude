/**
 * @file Delivers a text to a destination AI: prepare the tab, then ask its
 * adapter to insert (and optionally send) the text.
 *
 * Recovery: when an attempt fails in a way that GUARANTEES nothing was sent
 * (tab could not be prepared, editor never appeared, text could not be
 * inserted), it is retried once on a freshly loaded new chat. Failures after
 * the text may have left (send timeout…) are never retried: a duplicate
 * message is worse than an error.
 */

import { MessageType, PipelineStep } from '../shared/message-types.js';
import { RouterError, ErrorCode } from '../shared/errors.js';
import { DEFAULT_SETTINGS, scaleTimeouts } from '../shared/defaults.js';
import { sendToTab } from '../services/messaging.js';
import { hasText } from '../utils/text.js';
import { createLogger } from '../utils/logger.js';
import { prepareTarget } from './target-session.js';

const log = createLogger('delivery');

/** Submit-phase errors after which the target certainly did not receive anything. */
const NOTHING_SENT = new Set([ErrorCode.EDITOR_NOT_FOUND, ErrorCode.INSERT_FAILED]);
/** Errors that a new attempt cannot fix. */
const PERMANENT = new Set([
  ErrorCode.PROVIDER_NOT_FOUND,
  ErrorCode.NO_CONTENT,
  ErrorCode.TARGET_NOT_LOGGED_IN,
  ErrorCode.TARGET_RATE_LIMITED,
]);

/**
 * Whether a failed attempt may be retried without risking a double send (pure).
 * @param {RouterError} error
 * @param {'prepare' | 'submit'} phase  Where the attempt failed.
 */
export function isSafeToRetry(error, phase) {
  if (PERMANENT.has(error.code)) return false;
  return phase === 'prepare' || NOTHING_SENT.has(error.code);
}

/**
 * @typedef {import('./target-session.js').PrepareOptions & {
 *   autoSend?: boolean,
 *   onStep?: (step: string) => void,
 * }} DeliveryOptions
 *   onStep: progress callback (PipelineStep values), used by the pipeline.
 *
 * @param {string} providerId
 * @param {string} text
 * @param {DeliveryOptions} [options]
 */
export async function deliverText(providerId, text, options = {}) {
  if (!hasText(text)) throw new RouterError(ErrorCode.NO_CONTENT, 'Nothing to deliver');

  try {
    return await attempt(providerId, text, options);
  } catch (error) {
    const routerError = RouterError.from(error);
    if (!isSafeToRetry(routerError, routerError.phase)) throw routerError;
    log.warn(`Attempt failed (${routerError.code} during ${routerError.phase}), retrying on a fresh page`);
    return attempt(providerId, text, { ...options, fresh: true, retry: true });
  }
}

async function attempt(providerId, text, options) {
  const {
    autoSend = DEFAULT_SETTINGS.autoSend,
    onStep = () => {},
    timeouts = scaleTimeouts(),
    retry = false,
    ...prepareOptions
  } = options;
  let phase = 'prepare';
  try {
    onStep(PipelineStep.OPENING_TARGET);
    const target = await prepareTarget(providerId, { ...prepareOptions, timeouts });

    phase = 'submit';
    onStep(PipelineStep.SUBMITTING);
    const result = await sendToTab(
      target.tabId,
      MessageType.TARGET_SUBMIT,
      { text, autoSend, elementTimeout: timeouts.ELEMENT },
      { timeout: timeouts.SUBMIT },
    );

    log.info(`Delivered to ${providerId}`, { tabId: target.tabId, retry, ...result });
    return { ...target, ...result, retried: retry };
  } catch (error) {
    const routerError = RouterError.from(error);
    routerError.phase = phase;
    throw routerError;
  }
}
