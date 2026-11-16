/**
 * @file Popup controller.
 *
 *   - main action: send ChatGPT's latest answer to the target AI;
 *   - connection status of each AI;
 *   - latest sends (local history);
 *   - diagnostic tools (folded): test/open the target, insert a sample text,
 *     preview the Markdown read from ChatGPT, copy an anonymous page diagnostic.
 */

import { MessageType } from '../shared/message-types.js';
import { getProvider } from '../providers/registry.js';
import { getSettings } from '../services/settings.js';
import { localizeDocument, t } from '../utils/i18n.js';
import { hydrateIcons } from '../ui-kit/dom-icons.js';
import { applyTheme } from '../ui-kit/theme.js';
import { createLogger } from '../utils/logger.js';
import { runAction } from './feedback.js';
import { refreshStatus } from './status-list.js';
import { mountHistory } from './history-list.js';

const log = createLogger('popup');
const source = getProvider('chatgpt', 'source');
const SHORTCUT_COMMAND = 'send-latest-answer';

const $ = (id) => document.getElementById(id);
const setLabel = (id, text) => ($(id).querySelector('.button__label').textContent = text);

/** Context shared by the actions (filled in init). */
let target = null;

const refresh = () => refreshStatus($('provider-list'));
const seconds = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

// ---- Actions ----------------------------------------------------------------

function quickSend(button) {
  return runAction({
    button,
    feedback: $('feedback'),
    type: MessageType.ROUTE_REQUEST,
    payload: { trigger: 'popup' },
    onSuccess: () => t('quickSendDone', target.name),
    onSettled: refresh,
  });
}

/** Diagnostic actions report in their own feedback area, next to them. */
function tool(button, type, payload, onSuccess) {
  return runAction({ button, feedback: $('tools-feedback'), type, payload, onSuccess, onSettled: refresh });
}

const targetReady = (result) => t('testSuccess', [target.name, seconds(result.durationMs)]);

const TOOLS = {
  'test-target': (b) => tool(b, MessageType.OPEN_TARGET, { providerId: target.id, activate: false }, targetReady),
  'open-target': (b) => tool(b, MessageType.OPEN_TARGET, { providerId: target.id, activate: true }, targetReady),
  /** Inserts a sample text WITHOUT sending it: no message is consumed. */
  'insert-test': (b) =>
    tool(b, MessageType.DELIVER_TEXT, { providerId: target.id, text: t('testInsertText'), autoSend: false }, targetReady),
  /** Shows the Markdown that would be sent. */
  'read-source': (b) =>
    tool(b, MessageType.READ_SOURCE, { providerId: source.id }, (answer) => {
      showPreview(answer.markdown);
      return t('readSourceResult', String(answer.length));
    }),
  /** Anonymous structural snapshot (no conversation text) for troubleshooting. */
  'diagnose-source': (b) =>
    tool(b, MessageType.DIAGNOSE, { providerId: source.id }, (result) => {
      showPreview(result.text); // also visible, in case the clipboard is refused
      navigator.clipboard.writeText(result.text).catch(() => {});
      return t('diagnosticCopied');
    }),
};

function showPreview(text) {
  $('preview-text').textContent = text;
  $('preview').hidden = false;
}

async function copyPreview(button) {
  await navigator.clipboard.writeText($('preview-text').textContent);
  setLabel(button.id, t('copied'));
  setTimeout(() => setLabel(button.id, t('copyMarkdown')), 1500);
}

// ---- Setup --------------------------------------------------------------------

async function renderShortcut() {
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((c) => c.name === SHORTCUT_COMMAND)?.shortcut;
  const hint = $('shortcut-hint');
  if (!shortcut) return (hint.hidden = true);
  hint.textContent = `${t('optSectionShortcut')} : `;
  const kbd = document.createElement('kbd');
  kbd.textContent = shortcut;
  hint.append(kbd);
}

function renderTexts() {
  const { version } = chrome.runtime.getManifest();
  $('version').textContent = t('versionLabel', version) || `v${version}`;
  setLabel('quick-send', t('popupQuickSend', target.name));
  setLabel('test-target', t('actionTestTarget', target.name));
  setLabel('open-target', t('actionOpenTarget', target.name));
  setLabel('insert-test', t('actionInsertTest'));
  setLabel('read-source', t('actionReadSource', source.name));
  setLabel('diagnose-source', t('actionDiagnose', source.name));
  setLabel('copy-preview', t('copyMarkdown'));
}

function bindActions() {
  $('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('quick-send').addEventListener('click', (e) => quickSend(e.currentTarget));
  for (const [id, run] of Object.entries(TOOLS)) {
    $(id).addEventListener('click', (e) => run(e.currentTarget));
  }
  $('copy-preview').addEventListener('click', (e) => copyPreview(e.currentTarget));
}

async function init() {
  const settings = await getSettings();
  applyTheme(settings.theme);
  target = getProvider(settings.defaultTarget, 'target');

  localizeDocument();
  hydrateIcons();
  renderTexts();
  bindActions();
  await Promise.all([refresh(), mountHistory($('history-list'), { enabled: settings.keepHistory }), renderShortcut()]);
  document.body.dataset.ready = 'true';
  log.debug('Popup ready');
}

init();
