/**
 * @file Keyboard shortcuts (chrome://extensions/shortcuts lets the user change them).
 *
 *   send-latest-answer (Alt+Shift+C): sends the latest ChatGPT answer to the
 *   default target. Uses the current tab when it is ChatGPT, otherwise the
 *   most relevant ChatGPT tab — so it also works from anywhere in Chrome.
 */

import { getProvider } from '../providers/registry.js';
import { urlMatchesAny } from '../utils/url.js';
import { createLogger } from '../utils/logger.js';
import { runPipeline } from './pipeline.js';

const log = createLogger('commands');

const Command = Object.freeze({
  SEND_LATEST_ANSWER: 'send-latest-answer',
});

/**
 * @param {string} command
 * @param {chrome.tabs.Tab} [tab]  Active tab when the shortcut was pressed.
 */
export async function handleCommand(command, tab) {
  if (command !== Command.SEND_LATEST_ANSWER) return null;

  const source = getProvider('chatgpt', 'source');
  const sourceTabId = urlMatchesAny(tab?.url, source.matches) ? tab.id : undefined;
  try {
    return await runPipeline({ sourceProviderId: source.id, sourceTabId, trigger: 'shortcut' });
  } catch (error) {
    // Already reported to the source tab's UI by the pipeline when possible.
    log.warn('Shortcut failed', error.code, error.message);
    return null;
  }
}
