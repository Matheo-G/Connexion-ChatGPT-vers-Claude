/**
 * @file Text sent back to ChatGPT with an executing AI's answer (step 9).
 *
 *   ↩ Retour de Claude · /figma
 *
 *   <Claude's answer, in Markdown>
 *
 * The header tells ChatGPT (and the user) where the message comes from and
 * which brief it answers.
 */

/**
 * @param {{sourceName: string, markdown: string, command?: string | null}} input
 * @returns {string}
 */
export function composeReturn({ sourceName, markdown, command = null }) {
  const header = `↩ Retour de ${sourceName}${command ? ` · ${command}` : ''}`;
  return `${header}\n\n${markdown.trim()}`;
}
