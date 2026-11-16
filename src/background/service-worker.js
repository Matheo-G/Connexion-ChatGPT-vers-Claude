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
import { createMessageHandler } from '../services/messaging.js';
import { backgroundHandlers } from './message-router.js';
import { prepareTarget } from './target-session.js';
import { ensureContentScript, pingTab, injectIntoOpenTabs } from './injector.js';
import { getStatus } from './status.js';
import { deliverText } from './delivery.js';
import { readSource } from './source-session.js';
import { runPipeline } from './pipeline.js';
import { handleCommand } from './commands.js';

const log = createLogger('service-worker');

chrome.runtime.onMessage.addListener(createMessageHandler(backgroundHandlers));

chrome.commands.onCommand.addListener((command, tab) => {
  handleCommand(command, tab);
});

chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
  const { version } = chrome.runtime.getManifest();
  log.info(`Installed (${reason})`, { version, previousVersion });
  if (reason === 'install' || reason === 'update') injectIntoOpenTabs();
});

chrome.runtime.onStartup.addListener(() => {
  log.debug('Browser startup');
});

/**
 * Debug helpers, callable from the service worker console
 * (chrome://extensions → "service worker"):
 *   await aiRouter.prepareTarget('claude', { activate: false })
 *   await aiRouter.deliverText('claude', 'Bonjour', { autoSend: false })
 *   await aiRouter.readSource('chatgpt')
 *   await aiRouter.runPipeline({ trigger: 'api' })   // latest ChatGPT answer → Claude
 *   await aiRouter.getStatus()
 */
globalThis.aiRouter = Object.freeze({
  prepareTarget,
  deliverText,
  readSource,
  runPipeline,
  handleCommand,
  ensureContentScript,
  pingTab,
  getStatus,
  injectIntoOpenTabs,
});

log.debug('Service worker evaluated');
