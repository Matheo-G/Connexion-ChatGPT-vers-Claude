/**
 * @file /code — development task: implement, fix or review code from the brief.
 */

import { composePrompt, linksOf } from './prompt-kit.js';

/** @type {import('./registry.js').Workflow} */
export default Object.freeze({
  id: 'code',
  command: '/code',
  labelKey: 'workflowCode',
  label: 'Développement',
  icon: 'code',
  transform: ({ text, prompt, notes }) =>
    composePrompt({
      intro:
        'Tu es ingénieur logiciel senior. Réalise la tâche de développement décrite ci-dessous avec un code propre, lisible et prêt pour la production.',
      sections: [
        {
          title: 'Méthode',
          items: [
            "Commence par reformuler l'objectif en une ou deux phrases et lister tes hypothèses.",
            'Code modulaire, fonctions courtes, nommage explicite, commentaires utiles uniquement.',
            "Gère les erreurs et les cas limites ; n'invente pas d'API qui n'existe pas.",
            'Propose des tests (ou une procédure de vérification) pour ce que tu écris.',
            'Si le brief est ambigu sur un point bloquant, pose la question avant de coder.',
          ],
        },
        {
          title: 'Rendu attendu',
          items: [
            'Fichiers complets (chemin + contenu), pas de fragments à recoller.',
            'Explication courte des choix techniques et des alternatives écartées.',
          ],
        },
      ],
      contentLabel: 'Demande (préparée avec ChatGPT)',
      content: text,
      notes,
      links: linksOf(prompt),
    }),
});
