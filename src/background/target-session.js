/**
 * @file Gets a destination AI tab ready to receive a message:
 *   find or open the tab → (navigate to a new chat) → focus → wait for load
 *   → make sure the content runtime answers.
 *
 * Tab selection rules:
 *   newConversation = true  → a tab already on the "new chat" page,
 *                             else the best tab navigated to it,
 *                             else a new tab.
 *   newConversation = false → the best existing tab, else a new tab.
 */

import { getProvider } from '../providers/registry.js';
import { DEFAULT_SETTINGS } from '../shared/defaults.js';
import { isSamePage } from '../utils/url.js';
import { createLogger } from '../utils/logger.js';
import {
  queryTabs,
  pickBestTab,
  focusTab,
  createTab,
  navigateAndWait,
  waitForTabComplete,
} from './tab-manager.js';
import { ensureContentScript } from './injector.js';

const log = createLogger('target-session');

/**
 * @typedef {Object} PrepareOptions
 * @property {boolean} [newConversation]  Defaults to the user setting.
 * @property {boolean} [activate=true]    Bring the tab to the front.
 * @property {number}  [sourceTabId]      Open new tabs next to this one.
 *
 * @typedef {Object} PreparedTarget
 * @property {number} tabId
 * @property {string} providerId
 * @property {'reused' | 'navigated' | 'created'} mode
 * @property {Object} page       PING answer from the content runtime.
 * @property {number} durationMs
 */

/**
 * @param {string} providerId
 * @param {PrepareOptions} [options]
 * @returns {Promise<PreparedTarget>}
 */
export async function prepareTarget(providerId, options = {}) {
  const startedAt = Date.now();
  const provider = getProvider(providerId, 'target');
  const { newConversation = DEFAULT_SETTINGS.newConversation, activate = true, sourceTabId } = options;

  const { tab, mode, loaded } = await acquireTab(provider, { newConversation, activate, sourceTabId });
  if (activate) await focusTab(tab);
  await loaded;
  const page = await ensureContentScript(tab.id);

  const result = { tabId: tab.id, providerId, mode, page, durationMs: Date.now() - startedAt };
  log.info(`${provider.name} ready`, result);
  return result;
}

/**
 * Chooses the tab and starts loading it. Returns without awaiting the load
 * so the tab can be focused immediately (instant visual feedback).
 */
async function acquireTab(provider, { newConversation, activate, sourceTabId }) {
  const tabs = await queryTabs(provider.matches);

  if (newConversation) {
    const onNewChat = pickBestTab(tabs.filter((t) => isSamePage(t.url, provider.newChatUrl)));
    if (onNewChat) return reuse(onNewChat);

    const best = pickBestTab(tabs);
    if (best) {
      return { tab: best, mode: 'navigated', loaded: navigateAndWait(best.id, provider.newChatUrl) };
    }
  } else {
    const best = pickBestTab(tabs);
    if (best) return reuse(best);
  }

  const created = await createTab(provider.newChatUrl, { active: activate, sourceTabId });
  return { tab: created, mode: 'created', loaded: waitForTabComplete(created.id) };
}

function reuse(tab) {
  return { tab, mode: 'reused', loaded: waitForTabComplete(tab.id) };
}
