/**
 * @file TEMPLATE — copy this file to create a workflow (see docs/ADD_A_WORKFLOW.md).
 *
 *   1. cp _template.workflow.js mon-workflow.workflow.js and fill it in;
 *   2. import it in registry.js and add it to WORKFLOWS;
 *   3. add its name to _locales/fr/messages.json ("workflowMonWorkflow").
 *
 * This file is NOT registered: it is only a starting point.
 */

import { composePrompt, linksOf } from './prompt-kit.js';

/** @type {import('./registry.js').Workflow} */
export default Object.freeze({
  id: 'template', // unique, lowercase
  command: '/template', // typed at the start of a ChatGPT message to select it (or null)
  labelKey: 'workflowTemplate', // i18n key of the name shown in menus
  label: 'Modèle', // fallback name
  icon: 'sparkles', // see ui-kit/icons.js
  // target: 'claude',              // optional: another destination AI
  // options: { autoSend: false },  // optional: overrides user settings for this workflow
  transform: ({ text, prompt, notes }) =>
    composePrompt({
      intro: 'Décris ici le rôle de l’IA et le but.',
      sections: [{ title: 'Exigences', items: ['…'] }],
      contentLabel: 'Contenu (préparé avec ChatGPT)',
      content: text,
      notes,
      links: linksOf(prompt), // links from the user's message, always forwarded
    }),
});
