/**
 * @file /video — turns a video idea into generation-ready prompts for
 * Higgsfield (shot list, camera, lighting, style), prompts in English.
 */

import { composePrompt } from './prompt-kit.js';

/** @type {import('./registry.js').Workflow} */
export default Object.freeze({
  id: 'video',
  command: '/video',
  labelKey: 'workflowVideo',
  label: 'Vidéo Higgsfield',
  icon: 'video',
  transform: ({ text, notes }) =>
    composePrompt({
      intro:
        "Tu es réalisateur et prompt engineer spécialisé en génération vidéo par IA (Higgsfield). Transforme l'idée ci-dessous en prompts prêts à générer.",
      sections: [
        {
          title: 'Pour chaque plan',
          items: [
            'Numéro, durée (3 à 10 s) et intention du plan, en français.',
            'Prompt de génération EN ANGLAIS : sujet, action, décor, mouvement de caméra (dolly, orbit, crane…), cadrage, objectif, lumière, ambiance, style visuel.',
            'Prompt négatif en anglais (ce qu’il faut éviter).',
            'Transition vers le plan suivant.',
          ],
        },
        {
          title: 'Ensemble',
          items: [
            'Cohérence des personnages, des couleurs et de la lumière entre les plans.',
            'Format (16:9, 9:16…) et durée totale proposés selon l’usage (réseaux sociaux, présentation…).',
            'Termine par 2 variantes de style possibles.',
          ],
        },
      ],
      contentLabel: 'Idée de vidéo (préparée avec ChatGPT)',
      content: text,
      notes,
    }),
});
