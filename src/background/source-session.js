/**
 * @file Reads content from a source AI tab (ChatGPT today).
 *
 * When called from the provider's page itself (button under an answer,
 * step 4) that tab is used. Otherwise (popup, shortcut, any other page) the
 * most relevant open tab of the provider is chosen.
 */

import { MessageType } from '../shared/message-types.js';
import { RouterError, ErrorCode } from '../shared/errors.js';
import { getProvider } from '../providers/registry.js';
import { sendToTab } from '../services/messaging.js';
import { urlMatchesAny } from '../utils/url.js';
import { createLogger } from '../utils/logger.js';
import { queryTabs, pickBestTab, getTab } from './tab-manager.js';
import { ensureContentScript } from './injector.js';

const log = createLogger('source-session');

/**
 * @param {string} providerId
 * @param {{tabId?: number, messageId?: string}} [options]
 *   tabId: preferred tab (e.g. the sender's); ignored if it is not a page of the provider.
 * @returns {Promise<import('../providers/chatgpt/reader.js').ExtractedAnswer & {tabId: number}>}
 */
export async function readSource(providerId, { tabId, messageId } = {}) {
  const provider = getProvider(providerId, 'source');
  const sourceTabId = (await isProviderTab(tabId, provider)) ? tabId : await findSourceTab(provider);

  await ensureContentScript(sourceTabId);
  const answer = await sendToTab(sourceTabId, MessageType.SOURCE_EXTRACT, { messageId });
  log.info(`Read ${answer.length} chars from ${provider.name}`, { tabId: sourceTabId });
  return { ...answer, tabId: sourceTabId };
}

async function isProviderTab(tabId, provider) {
  if (tabId === undefined) return false;
  const tab = await getTab(tabId);
  return urlMatchesAny(tab?.url, provider.matches);
}

async function findSourceTab(provider) {
  const tab = pickBestTab(await queryTabs(provider.matches));
  if (!tab) throw new RouterError(ErrorCode.SOURCE_UNAVAILABLE, `No ${provider.name} tab open`);
  return tab.id;
}
