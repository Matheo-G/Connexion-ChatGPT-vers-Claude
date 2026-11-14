/**
 * @file Delivers a text to a destination AI: prepare the tab, then ask its
 * adapter to insert (and optionally send) the text.
 *
 * This is the last leg of the future pipeline (step 4), usable on its own
 * by the popup diagnostic in the meantime.
 */

import { MessageType } from '../shared/message-types.js';
import { RouterError, ErrorCode } from '../shared/errors.js';
import { DEFAULT_SETTINGS, Timeouts } from '../shared/defaults.js';
import { sendToTab } from '../services/messaging.js';
import { hasText } from '../utils/text.js';
import { createLogger } from '../utils/logger.js';
import { prepareTarget } from './target-session.js';

const log = createLogger('delivery');

/**
 * @typedef {import('./target-session.js').PrepareOptions & {autoSend?: boolean}} DeliveryOptions
 *
 * @param {string} providerId
 * @param {string} text
 * @param {DeliveryOptions} [options]
 */
export async function deliverText(providerId, text, options = {}) {
  if (!hasText(text)) throw new RouterError(ErrorCode.NO_CONTENT, 'Nothing to deliver');
  const { autoSend = DEFAULT_SETTINGS.autoSend, ...prepareOptions } = options;

  const target = await prepareTarget(providerId, prepareOptions);
  const result = await sendToTab(
    target.tabId,
    MessageType.TARGET_SUBMIT,
    { text, autoSend },
    { timeout: Timeouts.SUBMIT },
  );

  log.info(`Delivered to ${providerId}`, { tabId: target.tabId, ...result });
  return { ...target, ...result };
}
