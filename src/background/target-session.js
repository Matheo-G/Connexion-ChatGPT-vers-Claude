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
import { DEFAULT_SETTINGS, scaleTimeouts } from '../shared/defaults.js';
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
 * @property {boolean} [fresh=false]      Recovery: reload a new chat even if a tab looks ready.
 * @property {ReturnType<typeof scaleTimeouts>} [timeouts]  Patience-scaled waits.
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
  const {
    newConversation = DEFAULT_SETTINGS.newConversation,
    activate = true,
    sourceTabId,
    fresh = false,
    timeouts = scaleTimeouts(),
  } = options;

  const { tab, mode, loaded } = await acquireTab(provider, { newConversation, activate, sourceTabId, fresh, timeouts });
  if (activate) await focusTab(tab);
  await loaded;
  const page = await ensureContentScript(tab.id, { timeout: timeouts.CONTENT_READY });

  const result = { tabId: tab.id, providerId, mode, page, durationMs: Date.now() - startedAt };
  log.info(`${provider.name} ready`, result);
  return result;
}

/**
 * Chooses the tab and starts loading it. Returns without awaiting the load
 * so the tab can be focused immediately (instant visual feedback).
 */
async function acquireTab(provider, { newConversation, activate, sourceTabId, fresh, timeouts }) {
  const tabs = await queryTabs(provider.matches);
  const best = pickBestTab(tabs);
  const navigate = (tab) => ({
    tab,
    mode: 'navigated',
    loaded: navigateAndWait(tab.id, provider.newChatUrl, timeouts.TAB_LOAD),
  });
  const reuse = (tab) => ({ tab, mode: 'reused', loaded: waitForTabComplete(tab.id, { timeout: timeouts.TAB_LOAD }) });

  if (fresh) {
    // Recovery after a failed attempt: always load a brand-new chat page.
    if (best) return navigate(best);
  } else if (newConversation) {
    const onNewChat = pickBestTab(tabs.filter((t) => isSamePage(t.url, provider.newChatUrl)));
    if (onNewChat) return reuse(onNewChat);
    if (best) return navigate(best);
  } else if (best) {
    return reuse(best);
  }

  const created = await createTab(provider.newChatUrl, { active: activate, sourceTabId });
  return { tab: created, mode: 'created', loaded: waitForTabComplete(created.id, { timeout: timeouts.TAB_LOAD }) };
}
