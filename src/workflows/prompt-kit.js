/**
 * @file Shared helpers to write workflow prompts with a consistent shape:
 *
 *   <intro: role + goal>
 *
 *   ## <section title>
 *   - instruction…
 *
 *   ## Ma demande initiale             ← the user's message, without its command
 *
 *   ## <content label>
 *   <the ChatGPT answer, untouched>
 *
 *   ## Consignes personnelles      ← only when the user wrote some (options page)
 *
 * Instructions come first so Claude reads the frame before the content; the
 * content is never escaped or truncated (it is Markdown, often with code).
 *
 * The user's message to ChatGPT is forwarded too ("Ma demande initiale"):
 * it carries the intent and its links (a Figma file…), which ChatGPT's answer
 * may lack — ChatGPT may even refuse a task it cannot do itself.
 */

import { extractUrls } from '../utils/links.js';
import { stripTargetMention } from '../providers/routing.js';

/** Links of the user's message (see composePrompt and the default workflow). */
export const linksOf = (prompt) => extractUrls(prompt);

/**
 * The user's message without its leading slash command and without its
 * routing phrase: "/figma écris Hello, envoie-le à Copilot" → "écris Hello".
 * Where the text goes is the extension's job, not something the target AI
 * should read (it could think it has to forward it somewhere).
 */
export function requestOf(prompt) {
  const withoutCommand = String(prompt ?? '').replace(/^\s*\/[a-z0-9-]+(?=\s|$)/i, '');
  return stripTargetMention(withoutCommand).trim();
}

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
 * @param {string} [parts.prompt]       The user's message to ChatGPT: forwarded as
 *   "Ma demande initiale" (without its command), so Claude knows the intent even
 *   when ChatGPT's answer is weak or a refusal.
 * @param {string[]} [parts.excludeLinks] Links already placed elsewhere (e.g. in the intro).
 * @param {string} [parts.notes]        User's personal instructions for this workflow.
 * @returns {string}
 */
export function composePrompt({
  intro,
  sections = [],
  content,
  contentLabel = 'Contenu à traiter',
  prompt = '',
  excludeLinks = [],
  notes = '',
}) {
  const request = requestOf(prompt);
  // Links hidden behind a shortened label are not in the visible request text.
  const extraLinks = linksOf(prompt).filter((url) => !request.includes(url) && !excludeLinks.includes(url));

  const blocks = [intro.trim()];
  for (const { title, items } of sections) {
    blocks.push(`## ${title}\n${items.map((item) => `- ${item}`).join('\n')}`);
  }
  if (request) blocks.push(`## Ma demande initiale\n\n${request}`);
  if (extraLinks.length) blocks.push(`## Liens fournis dans ma demande\n${extraLinks.map((url) => `- ${url}`).join('\n')}`);
  const precedence = request ? '\n\n_Ce texte complète ma demande ; en cas de contradiction, ma demande initiale prime._' : '';
  blocks.push(`## ${contentLabel}${precedence}\n\n${content.trim()}`);
  if (notes.trim()) blocks.push(`## Consignes personnelles (prioritaires)\n\n${notes.trim()}`);
  return blocks.join('\n\n');
}
