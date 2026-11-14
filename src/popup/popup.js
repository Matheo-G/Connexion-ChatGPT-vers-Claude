/**
 * @file Popup controller.
 * Shows the connection status of each AI and offers a diagnostic to open
 * or test the destination (Claude) without sending anything.
 */

import { MessageType } from '../shared/message-types.js';
import { RouterError } from '../shared/errors.js';
import { DEFAULT_SETTINGS, Timeouts } from '../shared/defaults.js';
import { getProvider, listProviders } from '../providers/registry.js';
import { sendToBackground } from '../services/messaging.js';
import { localizeDocument, t } from '../utils/i18n.js';
import { hydrateIcons } from '../ui-kit/dom-icons.js';
import { icon } from '../ui-kit/icons.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('popup');
const target = getProvider(DEFAULT_SETTINGS.defaultTarget, 'target');

const STATE_LABELS = {
  ready: 'stateReady',
  'not-ready': 'stateNotReady',
  'logged-out': 'stateLoggedOut',
  'no-tab': 'stateNoTab',
  checking: 'stateChecking',
};

const $ = (id) => document.getElementById(id);

// ---- Status list --------------------------------------------------------

async function refreshStatus() {
  try {
    renderProviders(await sendToBackground(MessageType.GET_STATUS));
  } catch (error) {
    log.error('Status unavailable', error);
  }
}

function renderProviders(providers) {
  $('provider-list').replaceChildren(...providers.map(renderProvider));
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

// ---- Diagnostic actions -------------------------------------------------

/**
 * Runs a background action with busy state and feedback.
 * Actions that focus the Claude tab close the popup: the background keeps
 * going and the result is visible in Claude itself.
 */
async function runAction(button, type, payload) {
  setBusy(button, true);
  showFeedback('info', t('testRunning'));
  try {
    const result = await sendToBackground(type, payload, { timeout: Timeouts.DELIVERY });
    const seconds = `${(result.durationMs / 1000).toFixed(1).replace('.', ',')} s`;
    showFeedback('success', t('testSuccess', [target.name, seconds]));
  } catch (error) {
    showFeedback('error', RouterError.from(error).userMessage);
  } finally {
    setBusy(button, false);
    refreshStatus();
  }
}

const testConnection = (button) =>
  runAction(button, MessageType.OPEN_TARGET, { providerId: target.id, activate: false });

const openTarget = (button) =>
  runAction(button, MessageType.OPEN_TARGET, { providerId: target.id, activate: true });

/** Inserts a sample text WITHOUT sending it: no Claude message is consumed. */
const insertTestText = (button) =>
  runAction(button, MessageType.DELIVER_TEXT, {
    providerId: target.id,
    text: t('testInsertText'),
    autoSend: false,
    activate: true,
  });

function setBusy(button, busy) {
  for (const b of document.querySelectorAll('.actions .button')) b.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

/** @param {'info' | 'success' | 'error'} tone */
function showFeedback(tone, message) {
  const el = $('feedback');
  const glyph = { success: 'check', error: 'alert', info: 'refresh' }[tone];
  el.dataset.tone = tone;
  el.innerHTML = icon(glyph, { size: 16 });
  el.append(message);
  el.hidden = false;
}

// ---- Setup --------------------------------------------------------------

function renderStaticTexts() {
  const { version } = chrome.runtime.getManifest();
  $('version').textContent = t('versionLabel', version) || `v${version}`;
  $('test-target').querySelector('.button__label').textContent = t('actionTestTarget', target.name);
  $('open-target').querySelector('.button__label').textContent = t('actionOpenTarget', target.name);
  $('insert-test').querySelector('.button__label').textContent = t('actionInsertTest');
}

function bindActions() {
  $('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('test-target').addEventListener('click', (e) => testConnection(e.currentTarget));
  $('open-target').addEventListener('click', (e) => openTarget(e.currentTarget));
  $('insert-test').addEventListener('click', (e) => insertTestText(e.currentTarget));
}

function init() {
  localizeDocument();
  hydrateIcons();
  renderStaticTexts();
  bindActions();
  renderProviders(listProviders().map((p) => ({ ...p, state: 'checking' })));
  refreshStatus();
  log.debug('Popup ready');
}

init();
