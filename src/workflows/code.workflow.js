/**
 * @file /code — development task: implement, fix or review code from the brief.
 */

import { composePrompt } from './prompt-kit.js';

/** @type {import('./registry.js').Workflow} */
export default Object.freeze({
  id: 'code',
  command: '/code',
  labelKey: 'workflowCode',
  label: 'Développement',
  icon: 'code',
  /**
   * Personal instructions used until the user edits them in the options
   * (Réglages → Consignes personnelles). [Bracketed] parts are to be completed.
   */
  defaultNotes:
    "- JavaScript/TypeScript moderne, code modulaire, fonctions courtes, commentaires utiles uniquement, gestion propre des erreurs.\n- Avance par petites étapes : produis uniquement les fichiers concernés par l'étape, explique brièvement les choix techniques, puis indique comment vérifier que ça fonctionne.\n- Ne réécris pas un fichier entier pour une petite modification : montre précisément ce qui change.\n- Signale tout risque (sécurité, compatibilité navigateur, performance) au lieu de le passer sous silence.\n- Explications en français, noms de variables et code en anglais.\n- Mon contexte habituel : extensions Chrome (Manifest V3), interfaces web soignées. [Ajoute ici ta stack si tu en as une autre.]",
  /** What ChatGPT must prepare for Claude when the message starts with the command. */
  chatgptHint:
    'brief de développement : objectif, contexte technique, contraintes, critères de réussite.',
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
      prompt,
    }),
});
