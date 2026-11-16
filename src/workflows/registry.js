/**
 * @file Registry of workflows (what happens to a text before it reaches the target AI).
 *
 * Adding a workflow (see docs/ADD_A_WORKFLOW.md):
 *   1. copy _template.workflow.js to <id>.workflow.js and fill it in;
 *   2. import it below and add it to WORKFLOWS;
 *   3. add its name to _locales/fr/messages.json.
 *
 * Pure module: usable from the service worker and from pages.
 */

import { RouterError, ErrorCode } from '../shared/errors.js';
import defaultWorkflow from './default.workflow.js';
import figma from './figma.workflow.js';
import code from './code.workflow.js';
import video from './video.workflow.js';
import job from './job.workflow.js';
import mail from './mail.workflow.js';

/**
 * @typedef {Object} WorkflowInput
 * @property {string} text    Markdown coming from the source (the AI answer).
 * @property {string} prompt  The user message that led to it ('' if unknown).
 * @property {string} [notes] The user's personal instructions for this workflow (options page).
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
const WORKFLOWS = Object.freeze([defaultWorkflow, figma, code, video, job, mail]);

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

/**
 * The workflow whose command starts the user's message ("/figma Crée…"), or null.
 * The command must be the first word: "/figma" in the middle of a text does not count.
 * @param {string} prompt
 * @returns {Workflow | null}
 */
export function detectWorkflow(prompt) {
  const match = String(prompt ?? '').match(/^\s*(\/[a-z0-9-]+)(?=\s|$)/i);
  if (!match) return null;
  const command = match[1].toLowerCase();
  return WORKFLOWS.find((w) => w.command === command) ?? null;
}

/**
 * Which workflow applies, by priority:
 *   1. the one explicitly chosen (button menu);
 *   2. the slash command starting the user's message (if detection is enabled);
 *   3. the user's default workflow.
 * @param {{workflowId?: string, prompt?: string, defaultWorkflowId: string, detectSlashCommands: boolean}} input
 * @returns {{workflow: Workflow, reason: 'explicit' | 'command' | 'default'}}
 */
export function resolveWorkflow({ workflowId, prompt, defaultWorkflowId, detectSlashCommands }) {
  if (workflowId) return { workflow: getWorkflow(workflowId), reason: 'explicit' };
  const detected = detectSlashCommands ? detectWorkflow(prompt) : null;
  if (detected) return { workflow: detected, reason: 'command' };
  return { workflow: getWorkflow(defaultWorkflowId), reason: 'default' };
}
