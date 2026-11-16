/**
 * @file Default workflow: forwards the answer as is. Two additions only:
 * links from the user's message that the answer does not already contain
 * (ChatGPT rarely repeats them), and the user's personal instructions.
 */

import { linksOf } from './prompt-kit.js';

/** @type {import('./registry.js').Workflow} */
export default Object.freeze({
  id: 'default',
  command: null,
  labelKey: 'workflowDefault',
  label: 'Envoyer tel quel',
  icon: 'send',
  transform: ({ text, prompt = '', notes = '' }) => {
    const missingLinks = linksOf(prompt).filter((url) => !text.includes(url));
    const extras = [
      missingLinks.length ? `Liens fournis dans ma demande :\n${missingLinks.map((url) => `- ${url}`).join('\n')}` : '',
      notes.trim(),
    ].filter(Boolean);
    return extras.length ? `${text}\n\n---\n\n${extras.join('\n\n')}` : text;
  },
});
