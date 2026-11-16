/**
 * @file Registry of workflows (what happens to a text before it reaches the target AI).
 *
 * Adding a workflow (step 7 documents it fully):
 *   1. create workflows/<id>.workflow.js exporting a Workflow;
 *   2. import it below and add it to WORKFLOWS.
 *
 * Pure module: usable from the service worker and from pages.
 */

import { RouterError, ErrorCode } from '../shared/errors.js';
import defaultWorkflow from './default.workflow.js';

/**
 * @typedef {Object} WorkflowInput
 * @property {string} text    Markdown coming from the source (the AI answer).
 * @property {string} prompt  The user message that led to it ('' if unknown).
 *
 * @typedef {Object} Workflow
 * @property {string} id
 * @property {string | null} command  Slash command that selects it ('/code'…), or null.
 * @property {string} labelKey        i18n key of its name.
 * @property {string} label           Fallback name.
 * @property {string} icon            ui-kit icon name.
 * @property {string} [target]        Provider id overriding the default target.
 * @property {Partial<import('../shared/defaults.js').Settings>} [options]  Overrides (autoSend…).
 * @property {(input: WorkflowInput) => string | Promise<string>} transform
 */

/** @type {readonly Workflow[]} */
const WORKFLOWS = Object.freeze([defaultWorkflow]);

/** @returns {readonly Workflow[]} */
export function listWorkflows() {
  return WORKFLOWS;
}

/** @param {string} id */
export function getWorkflow(id) {
  const workflow = WORKFLOWS.find((w) => w.id === id);
  if (!workflow) throw new RouterError(ErrorCode.WORKFLOW_NOT_FOUND, `No workflow "${id}"`);
  return workflow;
}
