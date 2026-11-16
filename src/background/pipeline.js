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
import { getWorkflow } from '../workflows/registry.js';
import { getProvider } from '../providers/registry.js';
import { getSettings } from '../services/settings.js';
import { sendToTab, createRequestId } from '../services/messaging.js';
import { createLogger } from '../utils/logger.js';
import { readSource } from './source-session.js';
import { deliverText } from './delivery.js';
import { focusTab, getTab } from './tab-manager.js';

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
  const job = { jobId: createRequestId(), messageId, trigger, tabId: request.sourceTabId };
  try {
    return await execute(request, job, sourceProviderId);
  } catch (error) {
    const routerError = RouterError.from(error);
    notify(job, PipelineStep.FAILED, { error: routerError.toJSON() });
    log.warn(`Job ${job.jobId} failed`, routerError.code, routerError.message);
    throw routerError;
  } finally {
    running.delete(key);
  }
}

async function execute(request, job, sourceProviderId) {
  const settings = await getSettings();
  const workflow = getWorkflow(request.workflowId ?? settings.defaultWorkflow);
  const target = getProvider(request.targetProviderId ?? workflow.target ?? settings.defaultTarget, 'target');
  const options = { ...settings, ...workflow.options };
  log.info(`Job ${job.jobId}: ${sourceProviderId} → ${workflow.id} → ${target.id}`);

  notify(job, PipelineStep.EXTRACTING);
  const answer = await readSource(sourceProviderId, { tabId: job.tabId, messageId: job.messageId });
  job.tabId = answer.tabId;

  notify(job, PipelineStep.TRANSFORMING);
  const text = await workflow.transform({ text: answer.markdown, prompt: answer.prompt });

  const delivery = await deliverText(target.id, text, {
    autoSend: options.autoSend,
    newConversation: options.newConversation,
    activate: true,
    sourceTabId: answer.tabId,
    onStep: (step) => notify(job, step),
  });

  if (options.returnToSource) await returnTo(answer.tabId);
  notify(job, PipelineStep.DONE, { targetName: target.name, sent: delivery.sent });
  return { jobId: job.jobId, workflowId: workflow.id, targetId: target.id, ...delivery };
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
