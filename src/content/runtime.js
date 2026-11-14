/**
 * @file Generic content runtime, identical on every AI site.
 *
 * 1. Detects which provider owns the current page.
 * 2. Loads that provider's DOM adapter.
 * 3. Answers PING (handshake) and routes the adapter's message handlers.
 * 4. Announces itself to the service worker (CONTENT_READY).
 *
 * Site-specific code never lives here: see providers/<id>/adapter.js.
 */

import { MessageType } from '../shared/message-types.js';
import { findProviderByUrl } from '../providers/registry.js';
import { createMessageHandler, sendToBackground } from '../services/messaging.js';
import { createLogger } from '../utils/logger.js';

/**
 * Contract every providers/<id>/adapter.js must fulfil.
 * @typedef {Object} ProviderAdapter
 * @property {() => Object} describe   Extra info returned by PING.
 * @property {Record<string, Function>} handlers  MessageType → async handler.
 * @property {() => void} destroy       Removes injected UI / observers.
 */

/** Fired on the shared DOM so an orphaned previous instance can clean up. */
const TEARDOWN_EVENT = 'ai-router:teardown';

const log = createLogger('content');

/**
 * @param {{release: () => void}} instance  Provided by loader.js; frees the
 *   loader's "already running" slot when this instance is torn down.
 */
export async function boot({ release }) {
  const provider = findProviderByUrl(location.href);
  if (!provider) {
    log.debug('No provider for this page, staying idle', location.href);
    return;
  }

  replacePreviousInstance();
  const adapter = await loadAdapter(provider);
  const listener = createMessageHandler(buildHandlers(provider, adapter));
  chrome.runtime.onMessage.addListener(listener);
  watchForReplacement(adapter, listener, release);

  log.info(`Ready on ${provider.name}`);
  announceReady(provider);
}

async function loadAdapter(provider) {
  const module = await import(chrome.runtime.getURL(provider.adapterPath));
  return module.createAdapter({ log: createLogger(provider.id) });
}

function buildHandlers(provider, adapter) {
  return {
    ...adapter.handlers,
    [MessageType.PING]: () => ({
      providerId: provider.id,
      url: location.href,
      ...adapter.describe(),
    }),
  };
}

function replacePreviousInstance() {
  document.dispatchEvent(new CustomEvent(TEARDOWN_EVENT));
}

function watchForReplacement(adapter, listener, release) {
  document.addEventListener(
    TEARDOWN_EVENT,
    () => {
      log.debug('Replaced by a newer instance, tearing down');
      release();
      adapter.destroy();
      try {
        chrome.runtime.onMessage.removeListener(listener);
      } catch {
        /* context already invalidated */
      }
    },
    { once: true },
  );
}

function announceReady(provider) {
  sendToBackground(MessageType.CONTENT_READY, { providerId: provider.id, url: location.href })
    .catch((error) => log.debug('Service worker not reachable yet', error.message));
}
