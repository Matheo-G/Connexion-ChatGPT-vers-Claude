/**
 * @file Low-level tab operations: find, focus, create, navigate, wait.
 * Knows nothing about providers' DOM nor about the pipeline.
 */

import { RouterError, ErrorCode } from '../shared/errors.js';
import { Timeouts } from '../shared/defaults.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('tab-manager');

/**
 * @param {string[]} patterns  Chrome match patterns.
 * @returns {Promise<chrome.tabs.Tab[]>}
 */
export function queryTabs(patterns) {
  return chrome.tabs.query({ url: patterns });
}

/**
 * Most relevant tab: the active one of the focused window first,
 * then any active tab, then the most recently used.
 * @param {chrome.tabs.Tab[]} tabs
 * @returns {chrome.tabs.Tab | null}
 */
export function pickBestTab(tabs) {
  const score = (tab) => (tab.active ? 2 : 0) + (tab.highlighted ? 1 : 0);
  const sorted = [...tabs].sort(
    (a, b) => score(b) - score(a) || (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0),
  );
  return sorted[0] ?? null;
}

/** Brings a tab and its window to the front (restoring a minimised window). */
export async function focusTab(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  const window = await chrome.windows.get(tab.windowId);
  const restore = window.state === 'minimized' ? { state: 'normal' } : {};
  await chrome.windows.update(tab.windowId, { ...restore, focused: true });
  log.debug('Focused tab', tab.id);
}

/**
 * Opens a tab, right next to `sourceTabId` when given.
 * @param {string} url
 * @param {{active?: boolean, sourceTabId?: number}} [options]
 */
export async function createTab(url, { active = true, sourceTabId } = {}) {
  const source = sourceTabId ? await getTab(sourceTabId) : null;
  const tab = await chrome.tabs.create({
    url,
    active,
    ...(source && { windowId: source.windowId, index: source.index + 1, openerTabId: source.id }),
  });
  log.info('Opened tab', { tabId: tab.id, url });
  return tab;
}

/**
 * Navigates a tab and resolves once the NEW page has finished loading
 * (ignores the "complete" status of the page being left).
 * @param {number} tabId
 * @param {string} url
 */
export async function navigateAndWait(tabId, url, timeout = Timeouts.TAB_LOAD) {
  const loaded = waitForTabComplete(tabId, { timeout, afterNavigation: true });
  await chrome.tabs.update(tabId, { url });
  log.info('Navigating tab', { tabId, url });
  return loaded;
}

/** @returns {Promise<chrome.tabs.Tab | null>} */
export async function getTab(tabId) {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

/**
 * Resolves with the tab once its status is "complete".
 * Rejects with TARGET_UNAVAILABLE if the tab is closed, TIMEOUT if too slow.
 * @param {number} tabId
 * @param {{timeout?: number, afterNavigation?: boolean}} [options]
 *   afterNavigation: skip the current status, wait for a load to start then finish.
 * @returns {Promise<chrome.tabs.Tab>}
 */
export function waitForTabComplete(tabId, { timeout = Timeouts.TAB_LOAD, afterNavigation = false } = {}) {
  return new Promise((resolve, reject) => {
    let loadStarted = !afterNavigation;

    const finish = (settle, value) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      settle(value);
    };
    const closed = () =>
      new RouterError(ErrorCode.TARGET_UNAVAILABLE, 'Tab closed while loading', { tabId });

    const onUpdated = (id, change, tab) => {
      if (id !== tabId) return;
      if (change.status === 'loading') loadStarted = true;
      if (change.status === 'complete' && loadStarted) finish(resolve, tab);
    };
    const onRemoved = (id) => id === tabId && finish(reject, closed());
    const timer = setTimeout(
      () => finish(reject, new RouterError(ErrorCode.TIMEOUT, 'Tab load timed out', { tabId })),
      timeout,
    );

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);

    if (afterNavigation) return;
    getTab(tabId).then((tab) => {
      if (!tab) finish(reject, closed());
      else if (tab.status === 'complete') finish(resolve, tab);
    });
  });
}
