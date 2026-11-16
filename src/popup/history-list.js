/**
 * @file "Derniers envois" card: the latest jobs from the local history,
 * live-updated. Clicking a sent item reopens the Claude conversation.
 */

import { RouterError } from '../shared/errors.js';
import { getProvider } from '../providers/registry.js';
import { getWorkflow } from '../workflows/registry.js';
import { getHistory, onHistoryChanged } from '../services/history.js';
import { formatRelative } from '../utils/time.js';
import { t } from '../utils/i18n.js';
import { icon } from '../ui-kit/icons.js';

const SHOWN = 5;
const STATUS = {
  sent: { icon: 'check', labelKey: 'historySent' },
  inserted: { icon: 'send', labelKey: 'historyInserted' },
  failed: { icon: 'alert', labelKey: 'historyFailed' },
};

/**
 * @param {HTMLElement} list
 * @param {{enabled: boolean}} options
 */
export async function mountHistory(list, { enabled }) {
  render(list, enabled ? await getHistory() : null);
  onHistoryChanged((history) => render(list, enabled ? history : null));
}

/** @param {import('../services/history.js').HistoryEntry[] | null} history  null = disabled */
function render(list, history) {
  if (!history?.length) {
    const empty = document.createElement('li');
    empty.className = 'history__empty';
    empty.textContent = t(history ? 'popupHistoryEmpty' : 'popupHistoryOff');
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...history.slice(0, SHOWN).map(renderEntry));
}

function targetName(id) {
  try {
    return getProvider(id).name;
  } catch {
    return id;
  }
}

/** Workflow name, omitted for the default one (nothing special to tell). */
function workflowName(id) {
  if (!id || id === 'default') return '';
  try {
    const workflow = getWorkflow(id);
    return t(workflow.labelKey) || workflow.label;
  } catch {
    return '';
  }
}

/** @param {import('../services/history.js').HistoryEntry} entry */
function renderEntry(entry) {
  const status = STATUS[entry.status] ?? STATUS.failed;
  const item = document.createElement('li');
  item.className = 'history__item';
  item.dataset.status = entry.status;

  const glyph = document.createElement('span');
  glyph.className = 'history__icon';
  glyph.innerHTML = icon(status.icon, { size: 14 });

  const body = document.createElement('div');
  body.className = 'history__body';
  const preview = document.createElement('p');
  preview.className = 'history__preview';
  preview.textContent = entry.status === 'failed' ? new RouterError(entry.errorCode).userMessage : entry.preview;
  const meta = document.createElement('p');
  meta.className = 'history__meta';
  meta.textContent = [t(status.labelKey), targetName(entry.targetId), workflowName(entry.workflowId), formatRelative(entry.at)]
    .filter(Boolean)
    .join(' · ');
  body.append(preview, meta);
  item.append(glyph, body);

  if (entry.targetUrl && entry.status !== 'failed') {
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'icon-button history__open';
    open.innerHTML = icon('externalLink', { size: 14 });
    open.setAttribute('aria-label', t('historyOpen'));
    open.title = t('historyOpen');
    open.addEventListener('click', () => chrome.tabs.create({ url: entry.targetUrl }));
    item.append(open);
  }
  return item;
}
