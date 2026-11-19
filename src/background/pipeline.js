/**
 * @file The routing pipeline: Source → Workflow → Target → Post-actions.
 *
 *   1. read the answer from the source AI tab (ChatGPT);
 *   2. let the workflow transform it;
 *   3. deliver it to the target AI (open/focus, insert, send);
 *   4. optionally come back to the source tab.
 *
 * Every step is reported to the source tab (PIPELINE_STATUS) so its UI can
 * show progress; the final result (or RouterError) is returned to the caller.
 * Independent of how the job was triggered (button, shortcut, later: voice).
 */

import { MessageType, PipelineStep } from '../shared/message-types.js';
import { RouterError, ErrorCode } from '../shared/errors.js';
import { getWorkflow, resolveWorkflow } from '../workflows/registry.js';
import { getWorkflowNotes } from '../services/workflow-notes.js';
import { getProvider } from '../providers/registry.js';
import { DEFAULT_SETTINGS, scaleTimeouts } from '../shared/defaults.js';
import { getSettings } from '../services/settings.js';
import { addHistoryEntry, createEntry } from '../services/history.js';
import { sendToTab, createRequestId } from '../services/messaging.js';
import { createLogger } from '../utils/logger.js';
import { readSource } from './source-session.js';
import { deliverText } from './delivery.js';
import { focusTab, getTab } from './tab-manager.js';
import { withKeepAlive } from './keepalive.js';

const log = createLogger('pipeline');

/** Jobs in flight, to ignore double clicks: key = source tab + answer. */
const running = new Set();

/**
 * @typedef {Object} RouteRequest
 * @property {string} [sourceProviderId='chatgpt']
 * @property {number} [sourceTabId]    Defaults to the most relevant source tab.
 * @property {string} [messageId]      Defaults to the latest answer.
 * @property {string} [workflowId]     Defaults to the user setting.
 * @property {string} [targetProviderId]  Defaults to the workflow's, then the user setting.
 * @property {'button' | 'shortcut' | 'api'} [trigger='api']  Only used by the UI.
 */

/**
 * @param {RouteRequest} request
 */
export async function runPipeline(request = {}) {
  const { sourceProviderId = 'chatgpt', messageId, trigger = 'api' } = request;
  const key = `${request.sourceTabId ?? 'auto'}:${messageId ?? 'latest'}`;
  if (running.has(key)) throw new RouterError(ErrorCode.BUSY, `Job already running for ${key}`);

  running.add(key);
  const job = { jobId: createRequestId(), messageId, trigger, tabId: request.sourceTabId, sourceProviderId, locks: [key] };
  let settings = { ...DEFAULT_SETTINGS };
  try {
    settings = await getSettings();
    const result = await withKeepAlive(() => execute(request, job, settings));
    record(settings, job, { status: result.sent ? 'sent' : 'inserted', targetUrl: result.url });
    return result;
  } catch (error) {
    const routerError = RouterError.from(error);
    notify(job, PipelineStep.FAILED, { error: routerError.toJSON() });
    record(settings, job, { status: 'failed', errorCode: routerError.code });
    log.warn(`Job ${job.jobId} failed`, routerError.code, routerError.message);
    throw routerError;
  } finally {
    job.locks.forEach((lock) => running.delete(lock));
  }
}

async function execute(request, job, settings) {
  const { sourceProviderId } = job;
  if (request.workflowId) getWorkflow(request.workflowId); // fail fast on an unknown id

  notify(job, PipelineStep.EXTRACTING);
  const answer = await readSource(sourceProviderId, { tabId: job.tabId, messageId: job.messageId });
  job.tabId = answer.tabId;
  lockAnswer(job, `${answer.tabId}:${answer.messageId ?? 'latest'}`);

  // The workflow can depend on the user's message ("/figma …"): resolve it now.
  const { workflow, reason } = resolveWorkflow({
    workflowId: request.workflowId,
    prompt: answer.prompt,
    defaultWorkflowId: settings.defaultWorkflow,
    detectSlashCommands: settings.detectSlashCommands,
  });
  const target = getProvider(request.targetProviderId ?? workflow.target ?? settings.defaultTarget, 'target');
  const options = { ...settings, ...workflow.options };
  Object.assign(job, { workflowId: workflow.id, targetId: target.id });
  log.info(`Job ${job.jobId}: ${sourceProviderId} → ${workflow.id} (${reason}) → ${target.id}`);

  notify(job, PipelineStep.TRANSFORMING);
  const notes = (await getWorkflowNotes())[workflow.id] ?? '';
  const text = await workflow.transform({ text: answer.markdown, prompt: answer.prompt, notes });
  job.text = text;

  const delivery = await deliverText(target.id, text, {
    autoSend: options.autoSend,
    newConversation: options.newConversation,
    activate: true,
    sourceTabId: answer.tabId,
    timeouts: scaleTimeouts(settings.patience),
    onStep: (step) => notify(job, step),
  });

  if (options.returnToSource) await returnTo(answer.tabId);
  notify(job, PipelineStep.DONE, { targetName: target.name, sent: delivery.sent });
  return { jobId: job.jobId, workflowId: workflow.id, workflowReason: reason, targetId: target.id, ...delivery };
}

/**
 * Second lock, on the answer actually read: a shortcut or popup request
 * ("auto:latest") and a button click ("<tab>:<id>") on the same answer
 * would otherwise both pass the first check and send it twice.
 */
function lockAnswer(job, key) {
  if (job.locks.includes(key)) return;
  if (running.has(key)) throw new RouterError(ErrorCode.BUSY, `Answer already being sent (${key})`);
  running.add(key);
  job.locks.push(key);
}

/** Local history (if enabled) — a short preview only, see services/history.js. */
function record(settings, job, outcome) {
  if (!settings.keepHistory) return;
  addHistoryEntry(
    createEntry({
      id: job.jobId,
      at: Date.now(),
      sourceId: job.sourceProviderId,
      targetId: job.targetId ?? settings.defaultTarget,
      workflowId: job.workflowId ?? settings.defaultWorkflow,
      text: job.text ?? '',
      ...outcome,
    }),
  );
}

async function returnTo(tabId) {
  const tab = await getTab(tabId);
  if (tab) await focusTab(tab);
}

/** Fire-and-forget progress report to the source tab's UI. */
function notify(job, step, extra = {}) {
  if (job.tabId === undefined) return;
  const payload = { jobId: job.jobId, messageId: job.messageId, trigger: job.trigger, step, ...extra };
  sendToTab(job.tabId, MessageType.PIPELINE_STATUS, payload, { timeout: 2_000 }).catch(() => {});
}
