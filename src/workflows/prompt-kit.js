/**
 * @file Shared helpers to write workflow prompts with a consistent shape:
 *
 *   <intro: role + goal>
 *
 *   ## <section title>
 *   - instruction…
 *
 *   ## Liens fournis dans ma demande   ← links from the user's message, if any
 *   - https://…
 *
 *   ## <content label>
 *   <the ChatGPT answer, untouched>
 *
 *   ## Consignes personnelles      ← only when the user wrote some (options page)
 *
 * Instructions come first so Claude reads the frame before the content; the
 * content is never escaped or truncated (it is Markdown, often with code).
 *
 * The user's message to ChatGPT is not forwarded (the answer is what matters),
 * but the LINKS it contains always are: ChatGPT often does not repeat them,
 * and they are frequently the very object of the request (a Figma file…).
 */

import { extractUrls } from '../utils/links.js';

/** Links of the user's message, for workflows (see composePrompt's `links`). */
export const linksOf = (prompt) => extractUrls(prompt);

/**
 * @typedef {Object} PromptSection
 * @property {string} title
 * @property {string[]} items  Rendered as a bullet list.
 */

/**
 * @param {Object} parts
 * @param {string} parts.intro
 * @param {PromptSection[]} [parts.sections]
 * @param {string} parts.content        The text coming from the source AI.
 * @param {string} [parts.contentLabel]
 * @param {string} [parts.notes]        User's personal instructions for this workflow.
 * @param {string[]} [parts.links]      Links from the user's message (forwarded as is).
 * @returns {string}
 */
export function composePrompt({ intro, sections = [], content, contentLabel = 'Contenu à traiter', notes = '', links = [] }) {
  const blocks = [intro.trim()];
  for (const { title, items } of sections) {
    blocks.push(`## ${title}\n${items.map((item) => `- ${item}`).join('\n')}`);
  }
  if (links.length) blocks.push(`## Liens fournis dans ma demande\n${links.map((url) => `- ${url}`).join('\n')}`);
  blocks.push(`## ${contentLabel}\n\n${content.trim()}`);
  if (notes.trim()) blocks.push(`## Consignes personnelles (prioritaires)\n\n${notes.trim()}`);
  return blocks.join('\n\n');
}
