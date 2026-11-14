/**
 * @file Service worker entry point.
 *
 * Responsibilities (kept deliberately thin):
 *  - register every Chrome event listener synchronously at top level
 *    (MV3 requirement: listeners registered later are missed when the
 *    worker is woken up by an event);
 *  - delegate all logic to dedicated modules (message-router, tab-manager…).
 *
 * The worker can be terminated at any time after ~30 s of inactivity:
 * never keep critical state in module variables — use chrome.storage.session.
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('service-worker');

chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
  const { version } = chrome.runtime.getManifest();
  log.info(`Installed (${reason})`, { version, previousVersion });
});

chrome.runtime.onStartup.addListener(() => {
  log.debug('Browser startup');
});

log.debug('Service worker evaluated');
