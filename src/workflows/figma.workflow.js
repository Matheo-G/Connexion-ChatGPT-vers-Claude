/**
 * @file /figma — turns a brief into a Figma design, built by Claude through
 * the Figma MCP connector when available (long-term vision: voice → ChatGPT
 * → Claude → Figma MCP), or into a build-ready spec otherwise.
 */

import { composePrompt } from './prompt-kit.js';

/** @type {import('./registry.js').Workflow} */
export default Object.freeze({
  id: 'figma',
  command: '/figma',
  labelKey: 'workflowFigma',
  label: 'Design Figma',
  icon: 'figma',
  transform: ({ text, notes }) =>
    composePrompt({
      intro:
        "Tu es designer UI/UX senior. Réalise dans Figma le design décrit ci-dessous, en utilisant le connecteur Figma (MCP) s'il est disponible. S'il ne l'est pas, produis une spécification assez précise pour être reproduite telle quelle dans Figma.",
      sections: [
        {
          title: 'Exigences',
          items: [
            'Auto Layout partout, contraintes et redimensionnement (hug / fill) cohérents.',
            'Composants et variantes pour les éléments répétés ; états hover, focus, désactivé, erreur.',
            'Variables (couleurs, espacements, rayons, typographie) plutôt que des valeurs en dur ; grille de 4/8 px.',
            'Calques et frames nommés clairement, hiérarchie propre.',
            'Accessibilité : contrastes WCAG AA, tailles de cible ≥ 44 px, textes lisibles.',
            'Prévois les versions desktop et mobile si le brief ne précise rien.',
          ],
        },
        {
          title: 'Rendu attendu',
          items: [
            'Crée les frames dans Figma (ou décris-les frame par frame) en partant de la structure générale.',
            "Termine par un résumé : écrans créés, composants, variables, et points à valider avec moi.",
            'Si une information manque, fais une hypothèse raisonnable et signale-la.',
          ],
        },
      ],
      contentLabel: 'Brief (préparé avec ChatGPT)',
      content: text,
      notes,
    }),
});
