/**
 * @file Anonymous page diagnostic of a provider tab (see providers/<id>/diagnostics.js).
 * Lets the user send the structure of a page that the extension cannot read,
 * without sharing the conversation.
 */

import { MessageType } from '../shared/message-types.js';
import { RouterError, ErrorCode } from '../shared/errors.js';
import { getProvider } from '../providers/registry.js';
import { sendToTab } from '../services/messaging.js';
import { queryTabs, pickBestTab } from './tab-manager.js';
import { ensureContentScript } from './injector.js';

/**
 * @param {string} providerId
 * @returns {Promise<{text: string}>}
 */
export async function diagnoseProvider(providerId) {
  const provider = getProvider(providerId);
  const tab = pickBestTab(await queryTabs(provider.matches));
  if (!tab) throw new RouterError(ErrorCode.SOURCE_UNAVAILABLE, `No ${provider.name} tab open`);

  await ensureContentScript(tab.id);
  return sendToTab(tab.id, MessageType.PROVIDER_DIAGNOSE);
}
