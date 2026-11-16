/**
 * @file Declarative description of the options page.
 *
 * Adding a setting = adding its default in shared/defaults.js and one field
 * here: the page renders, loads and saves it automatically.
 *
 * Field types: 'toggle' (boolean), 'select' and 'segmented' (choices).
 */

import { listProviders } from '../providers/registry.js';
import { listWorkflows } from '../workflows/registry.js';

/**
 * @typedef {{value: string, labelKey?: string, label?: string}} Choice
 * @typedef {Object} Field
 * @property {string} key                Settings key.
 * @property {'toggle' | 'select' | 'segmented'} type
 * @property {string} labelKey
 * @property {string} [hintKey]
 * @property {() => Choice[]} [choices]
 * @typedef {Object} Section
 * @property {string} id
 * @property {string} titleKey
 * @property {Field[]} fields
 * @property {{id: string, labelKey: string, danger?: boolean}[]} [actions]
 * @property {boolean} [shortcut]        Renders the keyboard shortcut row.
 */

/** @type {Section[]} */
export const SETTINGS_SCHEMA = [
  {
    id: 'destination',
    titleKey: 'optSectionDestination',
    fields: [
      {
        key: 'defaultTarget',
        type: 'select',
        labelKey: 'optDefaultTarget',
        hintKey: 'optDefaultTargetHint',
        choices: () =>
          listProviders()
            .filter((p) => p.roles.includes('target'))
            .map((p) => ({ value: p.id, label: p.name })),
      },
      { key: 'newConversation', type: 'toggle', labelKey: 'optNewConversation', hintKey: 'optNewConversationHint' },
      { key: 'autoSend', type: 'toggle', labelKey: 'optAutoSend', hintKey: 'optAutoSendHint' },
    ],
  },
  {
    id: 'after',
    titleKey: 'optSectionAfter',
    fields: [
      { key: 'returnToSource', type: 'toggle', labelKey: 'optReturnToSource', hintKey: 'optReturnToSourceHint' },
    ],
  },
  {
    id: 'workflows',
    titleKey: 'optSectionWorkflows',
    fields: [
      {
        key: 'defaultWorkflow',
        type: 'select',
        labelKey: 'optDefaultWorkflow',
        hintKey: 'optDefaultWorkflowHint',
        choices: () => listWorkflows().map((w) => ({ value: w.id, labelKey: w.labelKey, label: w.label })),
      },
    ],
  },
  {
    id: 'shortcut',
    titleKey: 'optSectionShortcut',
    fields: [],
    shortcut: true,
  },
  {
    id: 'appearance',
    titleKey: 'optSectionAppearance',
    fields: [
      {
        key: 'theme',
        type: 'segmented',
        labelKey: 'optTheme',
        hintKey: 'optThemeHint',
        choices: () => [
          { value: 'auto', labelKey: 'themeAuto' },
          { value: 'light', labelKey: 'themeLight' },
          { value: 'dark', labelKey: 'themeDark' },
        ],
      },
    ],
  },
  {
    id: 'privacy',
    titleKey: 'optSectionPrivacy',
    fields: [{ key: 'keepHistory', type: 'toggle', labelKey: 'optKeepHistory', hintKey: 'optKeepHistoryHint' }],
    actions: [{ id: 'clear-history', labelKey: 'optClearHistory', danger: true }],
  },
  {
    id: 'advanced',
    titleKey: 'optSectionAdvanced',
    fields: [{ key: 'debugMode', type: 'toggle', labelKey: 'optDebugMode', hintKey: 'optDebugModeHint' }],
    actions: [{ id: 'reset-settings', labelKey: 'optReset', danger: true }],
  },
];
