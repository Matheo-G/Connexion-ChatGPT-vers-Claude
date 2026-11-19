/**
 * @file "↩ ChatGPT" buttons under the answers of an executing AI (Claude):
 * one click sends the answer back to the ChatGPT conversation that asked
 * for it (step 9). Site-independent: the provider gives its answer list.
 *
 * Same mechanics as the ChatGPT buttons (providers/chatgpt/mount.js):
 * debounced MutationObserver, idempotent scan, one button per answer,
 * re-created if the site re-renders its action bar. No button while an
 * answer is still being written.
 */

import { MessageType, PipelineStep } from '../../shared/message-types.js';
import { RouterError } from '../../shared/errors.js';
import { Timeouts } from '../../shared/defaults.js';
import { getProvider } from '../registry.js';
import { sendToBackground } from '../../services/messaging.js';
import { t } from '../../utils/i18n.js';
import { loadUiStyles, disposeShadowHosts } from '../../content/ui/shadow.js';
import { createSendButton, BUTTON_MARKER } from '../../content/ui/send-button.js';
import { showToast, disposeToasts } from '../../content/ui/toast.js';

const SCAN_DELAY = 300;
const RELOAD_MESSAGE = 'Mathéo AI Router a été mis à jour : rechargez la page pour continuer.';

const STEP_LABELS = {
  [PipelineStep.EXTRACTING]: 'stepExtracting',
  [PipelineStep.TRANSFORMING]: 'stepTransforming',
  [PipelineStep.OPENING_TARGET]: 'stepOpening',
  [PipelineStep.SUBMITTING]: 'stepSubmitting',
};

/**
 * @param {Object} options
 * @param {string} options.returnTo   Provider receiving the answers ("chatgpt").
 * @param {() => {reply: Element, messageId: string, actionBar: Element | null, streaming: boolean}[]} options.listAnswers
 * @param {{log: ReturnType<import('../../utils/logger.js').createLogger>}} options.context
 */
export function createReturnMounter({ returnTo, listAnswers, context: { log } }) {
  const destination = getProvider(returnTo);
  /** messageId → button controller. */
  const buttons = new Map();
  let observer = null;
  let timer = null;

  function scan() {
    timer = null;
    for (const { reply, messageId, actionBar, streaming } of listAnswers()) {
      if (streaming) continue;
      const parent = actionBar ?? reply;
      if (parent.querySelector(`:scope > [${BUTTON_MARKER}]`)) continue;
      buttons.get(messageId)?.destroy();
      const button = createButton(messageId);
      parent.append(button.host);
      buttons.set(messageId, button);
    }
  }

  const scheduleScan = () => {
    if (!timer) timer = setTimeout(scan, SCAN_DELAY);
  };

  function createButton(messageId) {
    return createSendButton({
      label: destination.name,
      icon: 'reply',
      title: t('returnButtonTitle', destination.name),
      menuTitle: '',
      sections: [],
      onSend: () => send(messageId),
    });
  }

  async function send(messageId) {
    const button = () => buttons.get(messageId);
    if (!chrome.runtime?.id) return reloadToast();
    button()?.setState('busy', t('stepExtracting'));
    try {
      const result = await sendToBackground(
        MessageType.ROUTE_REQUEST,
        { messageId, trigger: 'button' },
        { timeout: Timeouts.CALLER },
      );
      button()?.setState('success', t(result.sent ? 'stateSent' : 'stateInserted'));
    } catch (error) {
      if (!chrome.runtime?.id) return reloadToast();
      const routerError = RouterError.from(error);
      log.warn('Return failed', routerError.code, routerError.message);
      button()?.setState('error', t('stateFailed'));
      showToast({
        tone: 'error',
        message: routerError.userMessage,
        action: { label: t('toastRetry'), run: () => send(messageId) },
        closeLabel: t('toastDismiss'),
      });
    }
  }

  function reloadToast() {
    // chrome.i18n is gone with the old extension context: plain French text.
    showToast({ tone: 'error', message: RELOAD_MESSAGE, action: { label: 'Recharger', run: () => location.reload() } });
  }

  /** Progress reported by the background (PIPELINE_STATUS). */
  function onStatus(status) {
    const label = STEP_LABELS[status.step];
    if (label && status.trigger === 'button') buttons.get(status.messageId)?.setState('busy', t(label));
  }

  async function start() {
    await loadUiStyles();
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-is-streaming'] });
    scan();
    log.debug(`"↩ ${destination.name}" buttons active`);
  }

  function stop() {
    observer?.disconnect();
    clearTimeout(timer);
    buttons.forEach((button) => button.destroy());
    buttons.clear();
    disposeToasts();
    disposeShadowHosts();
  }

  return { start, stop, onStatus, count: () => document.querySelectorAll(`[${BUTTON_MARKER}]`).length };
}
