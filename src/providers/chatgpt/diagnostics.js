/**
 * @file Anonymous diagnostic of the ChatGPT page, copied from the popup.
 *
 * Answers "why can't the extension read this page?" without exposing the
 * conversation: which known markers exist (counts only), which layout was
 * recognised, and the skeleton of the last exchanges and of the composer.
 */

import { domSkeleton } from '../../utils/dom-skeleton.js';
import { LAYOUTS, SELECTORS } from './selectors.js';
import { describeLayout, isGenerating, isRendered } from './reader.js';

/** Generic turn containers across known and plausible future layouts. */
const TURN_CANDIDATES = '[data-turn-key], [data-testid^="conversation-turn-"], article';
const TURNS_SHOWN = 2;

function selectorCounts() {
  const selectors = new Set([
    ...LAYOUTS.flatMap((l) => [l.turn, ...l.reply, ...l.prompt, ...l.content]),
    ...SELECTORS.stopButton,
    ...SELECTORS.streamingMarker,
    'main',
    'form',
    '[contenteditable="true"]',
  ]);
  return [...selectors].map((selector) => {
    const all = [...document.querySelectorAll(selector)];
    return `${String(all.filter(isRendered).length).padStart(3)} / ${String(all.length).padEnd(3)} ${selector}`;
  });
}

function lastTurns() {
  const turns = [...document.querySelectorAll(TURN_CANDIDATES)]
    .filter(isRendered)
    .filter((el, _, all) => !all.some((o) => o !== el && o.contains(el)));
  return turns.slice(-TURNS_SHOWN);
}

function section(title, body) {
  return `### ${title}\n${body || '(none)'}`;
}

/** @returns {{text: string}} */
export function snapshot() {
  const { version } = chrome.runtime.getManifest();
  const main = [...document.querySelectorAll('main')].find(isRendered);
  const turns = lastTurns();
  const composer = [...document.querySelectorAll('form')].filter(isRendered).at(-1);
  const { layout, answers } = describeLayout();

  const text = [
    `Mathéo AI Router ${version} — diagnostic ChatGPT (sans contenu de conversation)`,
    `Page : ${location.pathname.replace(/[0-9a-f-]{16,}/gi, ':id')}`,
    `Layout reconnu : ${layout ?? 'aucun'} — réponses : ${answers} — génération en cours : ${isGenerating()}`,
    section('Marqueurs (visibles / total)', selectorCounts().join('\n')),
    section(
      `Derniers échanges (${turns.length})`,
      turns.length
        ? turns.map((t) => domSkeleton(t, { isRendered })).join('\n\n')
        : main && domSkeleton(main, { maxDepth: 10, maxNodes: 300, isRendered }),
    ),
    section('Zone de saisie', composer && domSkeleton(composer, { maxDepth: 8, maxNodes: 120, isRendered })),
  ].join('\n\n');

  return { text };
}
