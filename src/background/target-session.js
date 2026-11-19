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

import { getProvider, canReceive } from '../providers/registry.js';
import { DEFAULT_SETTINGS, scaleTimeouts } from '../shared/defaults.js';
import { isSamePage, urlMatchesAny } from '../utils/url.js';
import { RouterError, ErrorCode } from '../shared/errors.js';
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
 * @property {string}  [pageUrl]          The tab must show this conversation (way back to
 *   ChatGPT): a tab already on it, else `preferredTabId`, else the best tab, navigated to it.
 *   Overrides `newConversation`; `fresh` reloads it.
 * @property {number}  [preferredTabId]   Tab to reuse for `pageUrl` (the one the brief came from).
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
  const provider = getProvider(providerId);
  if (!canReceive(provider)) throw new RouterError(ErrorCode.PROVIDER_NOT_FOUND, `${provider.name} cannot receive text`);
  const {
    newConversation = DEFAULT_SETTINGS.newConversation,
    activate = true,
    sourceTabId,
    fresh = false,
    timeouts = scaleTimeouts(),
    pageUrl,
    preferredTabId,
  } = options;

  const choice = { newConversation, activate, sourceTabId, fresh, timeouts, pageUrl, preferredTabId };
  const { tab, mode, loaded } = await acquireTab(provider, choice);
  if (activate) await focusTab(tab);
  const loadedTab = await loaded;
  assertStillOnProvider(provider, loadedTab);
  const page = await ensureContentScript(tab.id, { timeout: timeouts.CONTENT_READY });

  const result = { tabId: tab.id, providerId, mode, page, durationMs: Date.now() - startedAt };
  log.info(`${provider.name} ready`, result);
  return result;
}

/** Hosts of sign-in pages a site may redirect to (Microsoft, Google, generic). */
const LOGIN_HOST = /(^|\.)(login\.microsoftonline\.com|login\.live\.com|accounts\.google\.com)$|(^|\.)(login|auth|signin|sso)\./i;

/**
 * After loading, the tab may have been redirected away from the AI (e.g.
 * Copilot → login.microsoftonline.com when the session expired). Our script
 * cannot run there: report it clearly instead of a vague "unavailable".
 */
function assertStillOnProvider(provider, tab) {
  if (!tab) return;
  // Without the "tabs" permission, Chrome hides the URL of pages outside our
  // host permissions: a hidden URL therefore means "left the AI's site" —
  // in practice its sign-in page (Microsoft, Google…).
  if (!tab.url) throw new RouterError(ErrorCode.TARGET_NOT_LOGGED_IN, `${provider.name} redirected outside its site`);
  if (urlMatchesAny(tab.url, provider.matches)) return;
  const host = new URL(tab.url).hostname;
  if (LOGIN_HOST.test(host)) {
    throw new RouterError(ErrorCode.TARGET_NOT_LOGGED_IN, `${provider.name} redirected to ${host}`);
  }
  throw new RouterError(ErrorCode.TARGET_UNAVAILABLE, `${provider.name} redirected to ${host}`, { url: tab.url });
}

/**
 * Chooses the tab and starts loading it. Returns without awaiting the load
 * so the tab can be focused immediately (instant visual feedback).
 */
async function acquireTab(provider, { newConversation, activate, sourceTabId, fresh, timeouts, pageUrl, preferredTabId }) {
  const tabs = await queryTabs(provider.matches);
  const best = pickBestTab(tabs);
  const navigate = (tab, url = provider.newChatUrl) => ({
    tab,
    mode: 'navigated',
    loaded: navigateAndWait(tab.id, url, timeouts.TAB_LOAD),
  });
  const reuse = (tab) => ({ tab, mode: 'reused', loaded: waitForTabComplete(tab.id, { timeout: timeouts.TAB_LOAD }) });

  if (pageUrl) {
    // A given conversation (way back to ChatGPT): never a new chat.
    const onPage = pickBestTab(tabs.filter((t) => isSamePage(t.url, pageUrl)));
    if (onPage && !fresh) return reuse(onPage);
    const preferred = tabs.find((t) => t.id === preferredTabId) ?? onPage ?? best;
    if (preferred) return navigate(preferred, pageUrl);
    const created = await createTab(pageUrl, { active: activate, sourceTabId });
    return { tab: created, mode: 'created', loaded: waitForTabComplete(created.id, { timeout: timeouts.TAB_LOAD }) };
  }

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
