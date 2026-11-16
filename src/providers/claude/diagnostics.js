/**
 * @file Anonymous diagnostic of the Claude page (no conversation text):
 * which markers exist and the skeleton of the composer.
 */

import { domSkeleton } from '../../utils/dom-skeleton.js';
import { SELECTORS, AUTH_PATHS } from './selectors.js';
import { findEditor, health } from './writer.js';

function selectorCounts() {
  const selectors = [...SELECTORS.editor, ...SELECTORS.sendButton, ...SELECTORS.composer, ...SELECTORS.loginForm];
  return [...new Set(selectors)].map((s) => `${String(document.querySelectorAll(s).length).padStart(3)}   ${s}`);
}

/** @returns {{text: string}} */
export function snapshot() {
  const { version } = chrome.runtime.getManifest();
  const editor = findEditor();
  const composer = editor?.closest('fieldset, form') ?? document.querySelector('fieldset, form');
  const state = health();
  const text = [
    `Mathéo AI Router ${version} — diagnostic Claude (sans contenu de conversation)`,
    `Page : ${location.pathname.replace(/[0-9a-f-]{16,}/gi, ':id')}${AUTH_PATHS.some((p) => location.pathname.startsWith(p)) ? ' (connexion)' : ''}`,
    `Connecté : ${state.loggedIn} — éditeur : ${state.editorFound} — bouton d'envoi : ${state.sendButtonFound}`,
    `### Marqueurs\n${selectorCounts().join('\n')}`,
    `### Zone de saisie\n${composer ? domSkeleton(composer, { maxDepth: 10, maxNodes: 200 }) : '(none)'}`,
  ].join('\n\n');
  return { text };
}
