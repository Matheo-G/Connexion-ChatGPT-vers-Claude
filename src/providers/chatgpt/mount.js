/**
 * @file Puts a "Send to Claude" button under every ChatGPT answer and runs
 * the routing job when it is clicked.
 *
 * ChatGPT is a React app with a virtualised thread: answers mount, unmount
 * and re-render all the time. A MutationObserver re-scans (debounced) and
 * the scan is idempotent: one button per action bar, re-created if React
 * wipes it.
 */

import { MessageType, PipelineStep } from '../../shared/message-types.js';
import { RouterError } from '../../shared/errors.js';
import { Timeouts } from '../../shared/defaults.js';
import { getProvider } from '../../providers/registry.js';
import { listWorkflows } from '../../workflows/registry.js';
import { getSettings } from '../../services/settings.js';
import { sendToBackground } from '../../services/messaging.js';
import { queryFirst } from '../../utils/dom.js';
import { t } from '../../utils/i18n.js';
import { loadUiStyles, disposeShadowHosts } from '../../content/ui/shadow.js';
import { createSendButton, BUTTON_MARKER } from '../../content/ui/send-button.js';
import { showToast, disposeToasts } from '../../content/ui/toast.js';
import { listAnswerTurns } from './reader.js';
import { SELECTORS } from './selectors.js';

const SCAN_DELAY = 150;

const STEP_LABELS = {
  [PipelineStep.EXTRACTING]: 'stepExtracting',
  [PipelineStep.TRANSFORMING]: 'stepTransforming',
  [PipelineStep.OPENING_TARGET]: 'stepOpening',
  [PipelineStep.WAITING_TARGET]: 'stepWaiting',
  [PipelineStep.SUBMITTING]: 'stepSubmitting',
};

/** Shown when the extension was reloaded/updated: this page's script is orphaned. */
const RELOAD_MESSAGE = 'Mathéo AI Router a été mis à jour : rechargez la page pour continuer.';

/**
 * @param {{log: ReturnType<import('../../utils/logger.js').createLogger>}} context
 */
export function createMounter({ log }) {
  /** messageId → button controller (the latest mounted one). */
  const buttons = new Map();
  let target = getProvider('claude', 'target');
  let observer = null;
  let timer = null;

  // ---- Mounting -----------------------------------------------------------

  function scan() {
    timer = null;
    for (const { turn, messageId } of listAnswerTurns()) {
      const bar = queryFirst(SELECTORS.actionBar, { root: turn, filter: () => true })?.element;
      if (!bar || bar.querySelector(`:scope > [${BUTTON_MARKER}]`)) continue;
      const button = createButton(messageId);
      bar.append(button.host);
      buttons.set(messageId, button);
    }
  }

  function scheduleScan() {
    if (!timer) timer = setTimeout(scan, SCAN_DELAY);
  }

  function createButton(messageId) {
    const button = createSendButton({
      label: target.name,
      title: t('sendButtonTitle', target.name),
      menuTitle: t('workflowMenuTitle'),
      workflows: listWorkflows().map((w) => ({ ...w, label: t(w.labelKey) || w.label })),
      onSend: (workflowId) => send(messageId, workflowId),
    });
    return button;
  }

  // ---- Sending --------------------------------------------------------------

  async function send(messageId, workflowId) {
    if (!chrome.runtime?.id) return showReloadToast();
    const button = () => buttons.get(messageId);
    button()?.setState('busy', t('stepExtracting'));
    try {
      const result = await sendToBackground(
        MessageType.ROUTE_REQUEST,
        { messageId, workflowId, trigger: 'button' },
        { timeout: Timeouts.DELIVERY },
      );
      button()?.setState('success', t(result.sent ? 'stateSent' : 'stateInserted'));
    } catch (error) {
      if (!chrome.runtime?.id) return showReloadToast();
      const routerError = RouterError.from(error);
      log.warn('Send failed', routerError.code, routerError.message);
      button()?.setState('error', t('stateFailed'));
      showToast({
        tone: 'error',
        message: routerError.userMessage,
        action: { label: t('toastRetry'), run: () => send(messageId, workflowId) },
        closeLabel: t('toastDismiss'),
      });
    }
  }

  function showReloadToast() {
    showToast({
      tone: 'error',
      message: RELOAD_MESSAGE,
      action: { label: 'Recharger', run: () => location.reload() },
    });
  }

  // ---- Progress from the background (PIPELINE_STATUS) ------------------------

  /** @param {{trigger: string, messageId?: string, step: string, targetName?: string, sent?: boolean, error?: Object}} status */
  function onStatus(status) {
    if (status.trigger === 'button') {
      const label = STEP_LABELS[status.step];
      if (label) buttons.get(status.messageId)?.setState('busy', t(label));
      return;
    }
    // Jobs started elsewhere (keyboard shortcut…): report with a toast.
    if (status.step === PipelineStep.DONE) {
      const key = status.sent ? 'toastSent' : 'toastInserted';
      showToast({ tone: 'success', message: t(key, status.targetName), closeLabel: t('toastDismiss') });
    } else if (status.step === PipelineStep.FAILED) {
      showToast({ tone: 'error', message: RouterError.from(status.error).userMessage, closeLabel: t('toastDismiss') });
    }
  }

  // ---- Lifecycle ------------------------------------------------------------------

  async function start() {
    await loadUiStyles();
    const settings = await getSettings().catch(() => null);
    if (settings) target = getProvider(settings.defaultTarget, 'target');
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
    log.debug('Send buttons active');
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
