/**
 * @file Options page: renders settings-schema.js, loads the stored values,
 * saves every change immediately ("Enregistré ✓") and stays in sync with
 * changes made elsewhere (another options tab, the popup).
 */

import { getSettings, updateSettings, resetSettings, onSettingsChanged } from '../services/settings.js';
import { clearHistory } from '../services/history.js';
import { getWorkflowNotes, setWorkflowNotes, NOTES_MAX_LENGTH } from '../services/workflow-notes.js';
import { listWorkflows } from '../workflows/registry.js';
import { localizeDocument, t } from '../utils/i18n.js';
import { hydrateIcons } from '../ui-kit/dom-icons.js';
import { applyTheme } from '../ui-kit/theme.js';
import { createLogger } from '../utils/logger.js';
import { SETTINGS_SCHEMA } from './settings-schema.js';

const log = createLogger('options');
const SHORTCUT_COMMAND = 'send-latest-answer';
const SAVED_VISIBLE_MS = 1_600;
const CONFIRM_WINDOW_MS = 3_000;
const NOTES_SAVE_DELAY = 500;

const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// ---- Rendering --------------------------------------------------------------

function renderSections() {
  const sections = SETTINGS_SCHEMA.map((section) => {
    const wrapper = el('section', 'section');
    wrapper.dataset.section = section.id;
    const card = el('div', 'card');
    card.append(...section.fields.map(renderField));
    if (section.shortcut) card.append(renderShortcutRow());
    if (section.workflowNotes) card.append(...renderWorkflowNotes());
    if (section.actions?.length) card.append(renderActions(section.actions));
    wrapper.append(el('h2', 'section__title', t(section.titleKey)), card);
    return wrapper;
  });
  $('sections').replaceChildren(...sections);
}

function renderRow(labelText, hintText, control, forId) {
  const row = el('div', 'row');
  const text = el('div', 'row__text');
  const label = el('label', 'row__label', labelText);
  if (forId) label.htmlFor = forId;
  text.append(label);
  if (hintText) text.append(el('p', 'row__hint', hintText));
  const holder = el('div', 'row__control');
  holder.append(control);
  row.append(text, holder);
  return row;
}

/** @param {import('./settings-schema.js').Field} field */
function renderField(field) {
  const id = `setting-${field.key}`;
  const control = CONTROL_RENDERERS[field.type](field, id);
  return renderRow(t(field.labelKey), field.hintKey && t(field.hintKey), control, field.type === 'segmented' ? null : id);
}

const choiceLabel = (choice) => (choice.labelKey && t(choice.labelKey)) || choice.label || choice.value;

const CONTROL_RENDERERS = {
  toggle(field, id) {
    const input = el('input', 'switch');
    Object.assign(input, { type: 'checkbox', id });
    input.setAttribute('role', 'switch');
    input.addEventListener('change', () => save(field.key, input.checked));
    return input;
  },

  select(field, id) {
    const select = el('select', 'select');
    select.id = id;
    for (const choice of field.choices()) {
      const option = el('option', '', choiceLabel(choice));
      option.value = choice.value;
      select.append(option);
    }
    select.addEventListener('change', () => save(field.key, select.value));
    return select;
  },

  segmented(field, id) {
    const group = el('div', 'segmented');
    group.id = id;
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', t(field.labelKey));
    for (const choice of field.choices()) {
      const input = el('input');
      Object.assign(input, { type: 'radio', name: id, value: choice.value, id: `${id}-${choice.value}` });
      input.addEventListener('change', () => input.checked && save(field.key, choice.value));
      const label = el('label', '', choiceLabel(choice));
      label.htmlFor = input.id;
      group.append(input, label);
    }
    return group;
  },
};

function renderShortcutRow() {
  const control = el('div', 'row__control');
  const keys = el('kbd', '', '…');
  keys.id = 'shortcut-keys';
  const change = el('button', 'button button--ghost', t('optShortcutChange'));
  change.type = 'button';
  // chrome:// pages cannot be linked; extension pages may open them as tabs.
  change.addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
  control.append(keys, change);
  return renderRow(t('optShortcut'), t('optShortcutHint'), control);
}

/** One textarea per workflow; saved while typing (debounced). */
function renderWorkflowNotes() {
  const intro = el('p', 'row__hint notes__intro', t('optWorkflowNotesHint'));
  const rows = listWorkflows().map((workflow) => {
    const id = `notes-${workflow.id}`;
    const row = el('div', 'row row--stacked');
    const label = el('label', 'row__label', t(workflow.labelKey) || workflow.label);
    label.htmlFor = id;
    if (workflow.command) label.append(' ', el('kbd', '', workflow.command));
    const textarea = el('textarea', 'textarea');
    Object.assign(textarea, { id, rows: 2, maxLength: NOTES_MAX_LENGTH, placeholder: t('optWorkflowNotesPlaceholder') });
    textarea.dataset.workflow = workflow.id;
    const counter = el('span', 'counter');
    const updateCounter = () => (counter.textContent = t('optWorkflowNotesCount', [String(textarea.value.length), String(NOTES_MAX_LENGTH)]));
    let timer = null;
    textarea.addEventListener('input', () => {
      updateCounter();
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await setWorkflowNotes(workflow.id, textarea.value);
        flashSaved();
      }, NOTES_SAVE_DELAY);
    });
    textarea.addEventListener('focus', updateCounter);
    row.append(label, textarea, counter);
    return row;
  });
  return [intro, ...rows];
}

async function fillWorkflowNotes() {
  const notes = await getWorkflowNotes();
  for (const textarea of document.querySelectorAll('textarea[data-workflow]')) {
    textarea.value = notes[textarea.dataset.workflow] ?? '';
  }
}

function renderActions(actions) {
  const row = el('div', 'row row--actions');
  for (const action of actions) {
    const button = el('button', `button ${action.danger ? 'button--danger' : 'button--ghost'}`, t(action.labelKey));
    button.type = 'button';
    button.id = `action-${action.id}`;
    button.addEventListener('click', () => confirmThen(button, action.labelKey, ACTIONS[action.id]));
    row.append(button);
  }
  return row;
}

// ---- Values -------------------------------------------------------------------

/** Reflects settings in the controls without triggering saves. */
function fill(settings) {
  for (const section of SETTINGS_SCHEMA) {
    for (const field of section.fields) {
      const value = settings[field.key];
      const id = `setting-${field.key}`;
      if (field.type === 'toggle') $(id).checked = value;
      else if (field.type === 'select') $(id).value = value;
      else {
        const radio = document.getElementById(`${id}-${value}`);
        if (radio) radio.checked = true;
      }
    }
  }
  applyTheme(settings.theme);
}

async function fillShortcut() {
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((c) => c.name === SHORTCUT_COMMAND)?.shortcut;
  $('shortcut-keys').textContent = shortcut || t('optShortcutNone');
}

async function save(key, value) {
  try {
    const settings = await updateSettings({ [key]: value });
    applyTheme(settings.theme);
    flashSaved();
    log.debug('Saved', key, value);
  } catch (error) {
    log.error('Save failed', error);
  }
}

let savedTimer = null;
function flashSaved() {
  const saved = $('saved');
  saved.dataset.visible = 'true';
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => (saved.dataset.visible = 'false'), SAVED_VISIBLE_MS);
}

// ---- Actions (two-click confirmation, no blocking dialogs) -------------------

const ACTIONS = {
  'clear-history': () => clearHistory(),
  'reset-settings': async () => fill(await resetSettings()),
};

async function confirmThen(button, labelKey, run) {
  if (button.dataset.confirm !== 'true') {
    button.dataset.confirm = 'true';
    button.textContent = t('confirmAction');
    setTimeout(() => {
      button.dataset.confirm = 'false';
      button.textContent = t(labelKey);
    }, CONFIRM_WINDOW_MS);
    return;
  }
  button.dataset.confirm = 'false';
  await run();
  button.textContent = t('done');
  flashSaved();
  setTimeout(() => (button.textContent = t(labelKey)), SAVED_VISIBLE_MS);
}

// ---- Setup ----------------------------------------------------------------------

async function init() {
  localizeDocument();
  renderSections();
  hydrateIcons();
  const { version } = chrome.runtime.getManifest();
  $('version').textContent = t('versionLabel', version) || `v${version}`;
  fill(await getSettings());
  await Promise.all([fillShortcut(), fillWorkflowNotes()]);
  onSettingsChanged(fill);
  document.body.dataset.ready = 'true';
}

init();
