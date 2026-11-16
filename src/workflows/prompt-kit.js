/**
 * @file Shared helpers to write workflow prompts with a consistent shape:
 *
 *   <intro: role + goal>
 *
 *   ## <section title>
 *   - instruction…
 *
 *   ## <content label>
 *   <the ChatGPT answer, untouched>
 *
 *   ## Consignes personnelles      ← only when the user wrote some (options page)
 *
 * Instructions come first so Claude reads the frame before the content; the
 * content is never escaped or truncated (it is Markdown, often with code).
 */

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
 * @returns {string}
 */
export function composePrompt({ intro, sections = [], content, contentLabel = 'Contenu à traiter', notes = '' }) {
  const blocks = [intro.trim()];
  for (const { title, items } of sections) {
    blocks.push(`## ${title}\n${items.map((item) => `- ${item}`).join('\n')}`);
  }
  blocks.push(`## ${contentLabel}\n\n${content.trim()}`);
  if (notes.trim()) blocks.push(`## Consignes personnelles (prioritaires)\n\n${notes.trim()}`);
  return blocks.join('\n\n');
}
