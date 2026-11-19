/**
 * @file Remembers which ChatGPT conversation each brief came from, so that
 * Claude's result goes back to THAT conversation (step 9), even if the user
 * has since opened other ChatGPT tabs or conversations.
 *
 * Stored in chrome.storage.session: survives the service worker going to
 * sleep, cleared when the browser closes (tab ids are only valid until then).
 * Only addresses are stored, never any text.
 */

import { isSamePage } from '../utils/url.js';

const KEY = 'conversationLinks';
const LIMIT = 50;

/**
 * @typedef {Object} ConversationLink
 * @property {string} targetId       'claude'
 * @property {number} targetTabId
 * @property {string} targetUrl      Address of the target page after sending.
 * @property {string} sourceUrl      ChatGPT conversation of the brief.
 * @property {number} sourceTabId
 * @property {string} workflowId
 * @property {number} at
 */

/** @returns {Promise<ConversationLink[]>} */
async function readLinks() {
  const stored = (await chrome.storage.session.get(KEY))[KEY];
  return Array.isArray(stored) ? stored : [];
}

/** Serialises writes (two jobs may finish together). */
let queue = Promise.resolve();

/** @param {ConversationLink} link */
export function rememberLink(link) {
  queue = queue
    .then(async () => {
      const others = (await readLinks()).filter(
        (l) => !(l.targetTabId === link.targetTabId && isSamePage(l.targetUrl, link.targetUrl)),
      );
      await chrome.storage.session.set({ [KEY]: [link, ...others].slice(0, LIMIT) });
    })
    .catch(() => {}); // a missing link only means "latest ChatGPT tab" later
  return queue;
}

/**
 * The link of a target page (pure, unit-tested):
 *   1. same conversation address (Claude's /chat/<id>);
 *   2. else the latest brief sent to this tab while it showed a NEW chat
 *      (`newChatUrl`): Claude gave the conversation its address afterwards.
 * @param {ConversationLink[]} links  Newest first.
 * @param {{targetId: string, tabId: number, url: string, newChatUrl: string}} page
 * @returns {ConversationLink | null}
 */
export function matchLink(links, { targetId, tabId, url, newChatUrl }) {
  const mine = links.filter((l) => l.targetId === targetId);
  return (
    mine.find((l) => isSamePage(l.targetUrl, url)) ??
    mine.find((l) => l.targetTabId === tabId && isSamePage(l.targetUrl, newChatUrl)) ??
    null
  );
}

/** @returns {Promise<ConversationLink | null>} */
export async function findLink(page) {
  return matchLink(await readLinks(), page);
}
