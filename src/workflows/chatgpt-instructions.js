/**
 * @file Text the user pastes ONCE into ChatGPT (Settings → Personalization →
 * Custom instructions, or a Project's instructions), so that ChatGPT knows
 * "/figma …" means "write a brief for Claude", instead of trying the task
 * itself and answering that it cannot.
 *
 * Generated from the workflow registry: adding a workflow (with a
 * `chatgptHint`) updates these instructions automatically.
 */

import { listWorkflows } from './registry.js';

/** ChatGPT's custom-instructions fields accept 1 500 characters. */
export const CHATGPT_INSTRUCTIONS_LIMIT = 1_500;

/** @param {readonly import('./registry.js').Workflow[]} [workflows] */
export function buildChatGPTInstructions(workflows = listWorkflows()) {
  const commands = workflows
    .filter((w) => w.command && w.chatgptHint)
    .map((w) => `- ${w.command} : ${w.chatgptHint}`);

  return [
    "J'utilise l'extension « Mathéo AI Router » : un clic envoie ta réponse à Claude (Anthropic), qui exécute la tâche avec ses propres outils.",
    '',
    'Quand mon message commence par une de ces commandes, ne fais pas la tâche toi-même : rédige un brief complet et autonome pour Claude.',
    ...commands,
    '',
    'Pour ces briefs :',
    '- Réponds uniquement par le brief, en Markdown, sans préambule.',
    "- Ne dis jamais que tu ne peux pas le faire : c'est Claude qui l'exécutera.",
    '- Conserve exactement mes contraintes, chiffres, textes et liens.',
    '- Si une information essentielle manque, ajoute une section « À préciser ».',
    'Sans commande, réponds normalement.',
  ].join('\n');
}
