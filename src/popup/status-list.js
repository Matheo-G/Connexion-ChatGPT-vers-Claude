/**
 * @file "Connexions" card: state of each AI tab (ready, logged out, no tab…).
 */

import { MessageType } from '../shared/message-types.js';
import { listProviders } from '../providers/registry.js';
import { sendToBackground } from '../services/messaging.js';
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
};

/**
 * @param {HTMLElement} list
 * @param {HTMLElement} [hint]  Shown when a page is not recognised.
 */
export async function refreshStatus(list, hint) {
  if (!list.children.length) render(list, listProviders().map((p) => ({ ...p, state: 'checking' })));
  try {
    const providers = await sendToBackground(MessageType.GET_STATUS);
    render(list, providers);
    if (hint) renderHint(hint, providers.filter((p) => p.state === 'unrecognized'));
  } catch (error) {
    log.error('Status unavailable', error);
  }
}

function renderHint(hint, unrecognized) {
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
