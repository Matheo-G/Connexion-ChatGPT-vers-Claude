/**
 * @file Popup action runner: busy state, success/error feedback, preview panel.
 */

import { RouterError } from '../shared/errors.js';
import { Timeouts } from '../shared/defaults.js';
import { sendToBackground } from '../services/messaging.js';
import { t } from '../utils/i18n.js';
import { icon } from '../ui-kit/icons.js';

const GLYPHS = { success: 'check', error: 'alert', info: 'refresh' };

/**
 * @param {HTMLElement} el  A `.feedback` element.
 * @param {'info' | 'success' | 'error'} tone
 * @param {string} message
 */
function showFeedback(el, tone, message) {
  el.dataset.tone = tone;
  el.innerHTML = icon(GLYPHS[tone], { size: 16 });
  el.append(message);
  el.hidden = false;
}

/** Disables every action button while one runs (no concurrent actions). */
function setBusy(button, busy) {
  for (const b of document.querySelectorAll('[data-action]')) b.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

/**
 * Sends a message to the background with busy state and feedback.
 * Actions that focus another tab close the popup: the background keeps going.
 * @param {Object} options
 * @param {HTMLButtonElement} options.button
 * @param {HTMLElement} options.feedback
 * @param {string} options.type       MessageType
 * @param {Object} [options.payload]
 * @param {(result: any) => string} options.onSuccess  Returns the success message.
 * @param {() => void} [options.onSettled]
 */
export async function runAction({ button, feedback, type, payload, onSuccess, onSettled }) {
  setBusy(button, true);
  showFeedback(feedback, 'info', t('testRunning'));
  try {
    const result = await sendToBackground(type, payload, { timeout: Timeouts.CALLER });
    showFeedback(feedback, 'success', onSuccess(result));
  } catch (error) {
    showFeedback(feedback, 'error', RouterError.from(error).userMessage);
  } finally {
    setBusy(button, false);
    onSettled?.();
  }
}
