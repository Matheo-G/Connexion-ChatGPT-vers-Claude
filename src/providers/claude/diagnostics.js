/**
 * @file Diagnostic section about Claude's answers (no conversation text):
 * which reader markers exist, and the skeleton of the last answer's row.
 * Appended to the composer diagnostic (shared/composer.js).
 */

import { domSkeleton } from '../../utils/dom-skeleton.js';
import { isRendered } from '../chatgpt/reader.js';
import { READER } from './selectors.js';
import { describeConversation, listAnswers } from './reader.js';

function counts() {
  const selectors = new Set([
    ...READER.reply,
    ...READER.prompt,
    READER.row,
    ...READER.content,
    ...READER.streaming,
    ...READER.stopButton,
    ...READER.actionBar,
    ...READER.artifact,
    '[data-testid]',
  ]);
  return [...selectors].map((selector) => {
    const all = [...document.querySelectorAll(selector)];
    return `${String(all.filter(isRendered).length).padStart(3)} / ${String(all.length).padEnd(3)} ${selector}`;
  });
}

/** data-testid values present on the page: the most useful markers to fix a selector. */
function testIds() {
  const ids = [...document.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid'));
  return [...new Set(ids)].sort().join(', ');
}

/** Row (or nearest container) of the last answer, else of the last user message. */
function lastExchange() {
  const answer = listAnswers().at(-1)?.reply;
  const anchor = answer ?? [...document.querySelectorAll(READER.prompt.join(','))].at(-1);
  if (!anchor) return null;
  return anchor.closest(READER.row) ?? anchor.parentElement?.parentElement ?? anchor;
}

/** @returns {string} */
export function conversationSection() {
  const { answers, generating, recognized } = describeConversation();
  const exchange = lastExchange();
  return [
    `### Conversation — réponses : ${answers} — génération en cours : ${generating} — reconnue : ${recognized}`,
    `### Marqueurs de lecture (visibles / total)\n${counts().join('\n')}`,
    `### data-testid présents\n${testIds() || '(aucun)'}`,
    `### Dernier échange\n${exchange ? domSkeleton(exchange, { maxDepth: 16, maxNodes: 300, isRendered }) : '(none)'}`,
  ].join('\n\n');
}
