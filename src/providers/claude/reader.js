/**
 * @file Reads Claude's answers from the page (step 9: "↩ ChatGPT").
 *
 *   listAnswers()            → every rendered answer, with its id and action bar
 *   extract({ messageId })   → one answer as Markdown (default: the latest)
 *
 * What it handles:
 *   - several Markdown blocks in one answer (text before and after a tool
 *     call, e.g. Figma): joined, the tool blocks themselves are skipped;
 *   - thinking blocks and collapsed sections (not rendered): skipped;
 *   - artifacts (side panel): their title is mentioned, the content stays in Claude;
 *   - the virtualised list: answers are identified by their row index.
 *
 * Refuses while Claude is writing (STILL_GENERATING) and when there is
 * nothing to read (NO_CONTENT).
 */

import { RouterError, ErrorCode } from '../../shared/errors.js';
import { queryFirst } from '../../utils/dom.js';
import { htmlToMarkdown } from '../../utils/html-to-markdown.js';
import { hasText } from '../../utils/text.js';
import { isRendered } from '../chatgpt/reader.js';
import { READER } from './selectors.js';

// ---- DOM helpers ----------------------------------------------------------

/** Rendered matches of the first selector that matches anything rendered, outermost only. */
function renderedMatches(selectors, root = document) {
  for (const selector of selectors) {
    const found = [...root.querySelectorAll(selector)].filter(isRendered);
    if (found.length) return found.filter((el) => !found.some((o) => o !== el && o.contains(el)));
  }
  return [];
}

const precedes = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

/** Every rendered answer, in page order. */
function replies() {
  return renderedMatches(READER.reply);
}

/** Stable id: the virtualised row index when there is one, else the position in the page. */
function idOf(reply, index) {
  const row = reply.closest(READER.row);
  for (const attribute of READER.rowIdAttributes) {
    const value = row?.getAttribute(attribute);
    if (value) return `row-${value}`;
  }
  return `pos-${index}`;
}

/**
 * The answer's action bar: searched in the answer, then in its ancestors as
 * long as they hold no other answer (the bar is often a sibling of the answer).
 */
function actionBarOf(reply, all) {
  let scope = reply;
  for (let depth = 0; scope && depth < 4; depth += 1, scope = scope.parentElement) {
    if (all.some((other) => other !== reply && scope.contains(other))) return null;
    const bar = queryFirst(READER.actionBar, { root: scope, filter: isRendered })?.element;
    if (bar) return bar;
  }
  return null;
}

// ---- State ----------------------------------------------------------------------

export function isGenerating() {
  return Boolean(queryFirst(READER.streaming, { filter: () => true }) || queryFirst(READER.stopButton));
}

/** Whether this answer is the one being written. */
function isStreaming(reply) {
  return reply.matches(READER.streaming.join(',')) || Boolean(reply.querySelector(READER.streaming.join(',')));
}

/**
 * `recognized` is false on a conversation that shows the user's messages but
 * no answer we can find, while Claude is idle: the page has probably changed.
 */
export function describeConversation() {
  const answers = replies().length;
  const prompts = renderedMatches(READER.prompt).length;
  return {
    answers,
    generating: isGenerating(),
    recognized: answers > 0 || prompts === 0 || isGenerating(),
  };
}

// ---- Reading ----------------------------------------------------------------------

/** Text of the user message that led to `reply`. */
function promptFor(reply) {
  const prompts = renderedMatches(READER.prompt).filter((p) => precedes(p, reply));
  return prompts.at(-1)?.textContent.trim() ?? '';
}

function artifactTitles(reply) {
  const cards = READER.artifact.flatMap((selector) => [...reply.querySelectorAll(selector)]);
  const titles = cards
    .filter((card, _, all) => !all.some((o) => o !== card && o.contains(card)))
    .map((card) => card.textContent.replace(/\s+/g, ' ').trim().slice(0, 120))
    .filter(Boolean);
  return [...new Set(titles)];
}

function toMarkdown(reply) {
  const blocks = renderedMatches(READER.content, reply);
  const markdown = (blocks.length ? blocks : [reply])
    .map((block) => htmlToMarkdown(block, { ignore: READER.ignoreInContent }))
    .filter(hasText)
    .join('\n\n');
  const artifacts = artifactTitles(reply).map((title) => `> 📎 Artefact dans Claude : ${title}`);
  return [markdown, ...artifacts].filter(hasText).join('\n\n');
}

/**
 * Every rendered answer — where the "↩ ChatGPT" buttons go.
 * @returns {{reply: Element, messageId: string, actionBar: Element | null, streaming: boolean}[]}
 */
export function listAnswers() {
  const all = replies();
  return all.map((reply, index) => ({
    reply,
    messageId: idOf(reply, index),
    actionBar: actionBarOf(reply, all),
    streaming: isStreaming(reply),
  }));
}

/**
 * @param {{messageId?: string}} [options]
 * @returns {{markdown: string, prompt: string, messageId: string, length: number}}
 */
export function extract({ messageId } = {}) {
  const answers = listAnswers();
  if (!answers.length) throw new RouterError(ErrorCode.NO_CONTENT, 'No Claude answer on the page');

  const answer = messageId ? answers.find((a) => a.messageId === messageId) : answers.at(-1);
  if (!answer) throw new RouterError(ErrorCode.NO_CONTENT, `Answer ${messageId} not found`);
  const isLatest = answer === answers.at(-1);
  if (answer.streaming || (isLatest && isGenerating())) {
    throw new RouterError(ErrorCode.STILL_GENERATING, 'Claude is still writing');
  }

  const markdown = toMarkdown(answer.reply);
  if (!hasText(markdown)) throw new RouterError(ErrorCode.NO_CONTENT, 'Answer is empty');
  return { markdown, prompt: promptFor(answer.reply), messageId: answer.messageId, length: markdown.length };
}
