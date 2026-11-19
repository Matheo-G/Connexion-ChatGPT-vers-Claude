/**
 * @file Registry of supported AI sites.
 *
 * Adding a provider (Gemini, Grok…):
 *   1. create providers/<id>/index.js (metadata) and adapter.js (DOM logic);
 *   2. import it below;
 *   3. add its URL patterns to manifest.json (host_permissions + content_scripts).
 *
 * This module is pure data: importable from the service worker and pages.
 */

import { RouterError, ErrorCode } from '../shared/errors.js';
import { urlMatchesAny } from '../utils/url.js';
import chatgpt from './chatgpt/index.js';
import claude from './claude/index.js';
import copilot from './copilot/index.js';

/**
 * @typedef {'source' | 'target'} ProviderRole
 *
 * @typedef {Object} ProviderDefinition
 * @property {string} id            Stable identifier ('claude').
 * @property {string} name          Display name ('Claude').
 * @property {string[]} matches     Chrome match patterns of the site.
 * @property {string} newChatUrl    URL opening an empty conversation.
 * @property {readonly ProviderRole[]} roles
 * @property {string} adapterPath   Extension-relative path of the DOM adapter.
 * @property {readonly string[]} [aliases]  Names the user may say/write to pick it ("envoie à Copilot").
 */

/** @type {readonly ProviderDefinition[]} */
const PROVIDERS = Object.freeze([chatgpt, claude, copilot]);

/** @returns {readonly ProviderDefinition[]} */
export function listProviders() {
  return PROVIDERS;
}

/**
 * @param {string} id
 * @param {ProviderRole} [role]  When given, the provider must support it.
 * @returns {ProviderDefinition}
 */
export function getProvider(id, role) {
  const provider = PROVIDERS.find((p) => p.id === id);
  if (!provider || (role && !provider.roles.includes(role))) {
    throw new RouterError(ErrorCode.PROVIDER_NOT_FOUND, `No provider "${id}" with role ${role}`);
  }
  return provider;
}

/**
 * @param {string} url
 * @returns {ProviderDefinition | null}
 */
export function findProviderByUrl(url) {
  return PROVIDERS.find((p) => urlMatchesAny(url, p.matches)) ?? null;
}
