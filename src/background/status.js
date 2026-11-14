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
 * @property {'ready' | 'not-ready' | 'no-tab'} state
 *   not-ready = tab open but no content script answering (opened before install, still loading…).
 */

/** @returns {Promise<ProviderStatus[]>} */
export function getStatus() {
  return Promise.all(listProviders().map(getProviderStatus));
}

async function getProviderStatus(provider) {
  const tabs = await queryTabs(provider.matches);
  const best = pickBestTab(tabs);
  const state = !best ? 'no-tab' : (await pingTab(best.id)) ? 'ready' : 'not-ready';
  return {
    id: provider.id,
    name: provider.name,
    roles: provider.roles,
    tabCount: tabs.length,
    state,
  };
}
