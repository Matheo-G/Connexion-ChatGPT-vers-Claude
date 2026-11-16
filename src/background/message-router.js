/**
 * @file Maps every message the service worker handles to its handler.
 * Handlers stay one-liners: logic lives in dedicated modules.
 */

import { MessageType } from '../shared/message-types.js';
import { createLogger } from '../utils/logger.js';
import { prepareTarget } from './target-session.js';
import { getStatus } from './status.js';
import { deliverText } from './delivery.js';
import { readSource } from './source-session.js';

const log = createLogger('router');

/** @type {Record<string, (payload: Object, sender: chrome.runtime.MessageSender) => any>} */
export const backgroundHandlers = {
  [MessageType.CONTENT_READY]: ({ providerId, url }, sender) => {
    log.debug('Content ready', { providerId, tabId: sender.tab?.id, url });
  },

  [MessageType.OPEN_TARGET]: ({ providerId = 'claude', activate, newConversation }, sender) =>
    prepareTarget(providerId, { activate, newConversation, sourceTabId: sender.tab?.id }),

  [MessageType.DELIVER_TEXT]: ({ providerId = 'claude', text, ...options }, sender) =>
    deliverText(providerId, text, { ...options, sourceTabId: sender.tab?.id }),

  [MessageType.READ_SOURCE]: ({ providerId = 'chatgpt', messageId }, sender) =>
    readSource(providerId, { messageId, tabId: sender.tab?.id }),

  [MessageType.GET_STATUS]: () => getStatus(),
};
