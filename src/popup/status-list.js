/**
 * @file "Connexions" card: state of each AI tab (ready, logged out, no tab…).
 *
 * Never spins forever: the background gets a few seconds (and a second
 * chance, e.g. while the service worker restarts); after that every AI is
 * shown "Indisponible" with the exact error and a retry button.
 */

import { MessageType } from '../shared/message-types.js';
import { listProviders } from '../providers/registry.js';
import { sendToBackground } from '../services/messaging.js';
import { RouterError } from '../shared/errors.js';
import { sleep } from '../utils/async.js';
import { t } from '../utils/i18n.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('popup-status');

const STATE_LABELS = {
  ready: 'stateReady',
  'not-ready': 'stateNotReady',
  'logged-out': 'stateLoggedOut',
  unrecognized: 'stateUnrecognized',
  'no-tab': 'stateNoTab',
  checking: 'stateChecking',
  unavailable: 'stateUnavailable',
};

const STATUS_TIMEOUT = 6_000;
const ATTEMPTS = 2;
const RETRY_DELAY = 800;

/**
 * @param {HTMLElement} list
 * @param {HTMLElement} [hint]  Shown when a page is not recognised, or on failure.
 */
export async function refreshStatus(list, hint) {
  if (!list.children.length) render(list, withState('checking'));
  let lastError = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const providers = await sendToBackground(MessageType.GET_STATUS, {}, { timeout: STATUS_TIMEOUT });
      render(list, providers);
      if (hint) renderHint(hint, providers.filter((p) => p.state === 'unrecognized'));
      return;
    } catch (error) {
      lastError = RouterError.from(error);
      log.warn(`Status attempt ${attempt} failed`, lastError.code, lastError.message);
      if (attempt < ATTEMPTS) await sleep(RETRY_DELAY);
    }
  }
  render(list, withState('unavailable'));
  if (hint) renderFailure(hint, lastError, () => refreshStatus(list, hint));
}

const withState = (state) => listProviders().map((p) => ({ ...p, state }));

/** Explains the failure with the exact technical message (to report it) and a retry. */
function renderFailure(hint, error, retry) {
  hint.hidden = false;
  hint.dataset.tone = 'error';
  const message = document.createElement('span');
  message.textContent = t('statusUnavailableHint');
  const detail = document.createElement('code');
  detail.className = 'status-hint__detail';
  detail.textContent = `${error.code} — ${error.message}`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button--ghost status-hint__retry';
  button.textContent = t('toastRetry');
  button.addEventListener('click', () => {
    hint.hidden = true;
    retry();
  });
  hint.replaceChildren(message, detail, button);
}

function renderHint(hint, unrecognized) {
  delete hint.dataset.tone;
  hint.hidden = !unrecognized.length;
  if (unrecognized.length) hint.textContent = t('unrecognizedHint', unrecognized.map((p) => p.name).join(', '));
}

function render(list, providers) {
  list.replaceChildren(...providers.map(renderProvider));
}

function renderProvider({ name, roles, state }) {
  const item = document.createElement('li');
  item.className = 'provider';
  item.dataset.state = state;

  const label = document.createElement('span');
  label.className = 'provider__name';
  label.textContent = name;
  const role = document.createElement('span');
  role.className = 'provider__role';
  role.textContent = t(roles.includes('target') ? 'roleTarget' : 'roleSource');
  label.append(role);

  const status = document.createElement('span');
  status.className = 'provider__state';
  status.innerHTML = '<span class="dot" aria-hidden="true"></span>';
  status.append(t(STATE_LABELS[state]) || state);

  item.append(label, status);
  return item;
}
