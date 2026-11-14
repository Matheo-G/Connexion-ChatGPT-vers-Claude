/**
 * @file Connection status of every provider, shown in the popup.
 */

import { listProviders } from '../providers/registry.js';
import { queryTabs, pickBestTab } from './tab-manager.js';
import { pingTab } from './injector.js';

/**
 * @typedef {Object} ProviderStatus
 * @property {string} id
 * @property {string} name
 * @property {readonly string[]} roles
 * @property {number} tabCount
 * @property {'ready' | 'logged-out' | 'not-ready' | 'no-tab'} state
 *   not-ready  = tab open but no content script answering (still loading, crashed…);
 *   logged-out = the adapter reports the login screen.
 */

/** @returns {Promise<ProviderStatus[]>} */
export function getStatus() {
  return Promise.all(listProviders().map(getProviderStatus));
}

async function getProviderStatus(provider) {
  const tabs = await queryTabs(provider.matches);
  const best = pickBestTab(tabs);
  const page = best ? await pingTab(best.id) : null;
  return {
    id: provider.id,
    name: provider.name,
    roles: provider.roles,
    tabCount: tabs.length,
    state: toState(best, page),
  };
}

function toState(tab, page) {
  if (!tab) return 'no-tab';
  if (!page) return 'not-ready';
  return page.loggedIn === false ? 'logged-out' : 'ready';
}
