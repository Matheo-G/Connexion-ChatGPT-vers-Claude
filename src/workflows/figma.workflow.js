/**
 * @file /figma — turns a brief into a Figma design, built by Claude through
 * the Figma MCP connector when available (long-term vision: voice → ChatGPT
 * → Claude → Figma MCP), or into a build-ready spec otherwise.
 *
 * A Figma link in the user's message (figma.com/design/…, /board/…, with or
 * without node-id) becomes the file to work IN, instead of creating a new one.
 */

import { composePrompt, linksOf } from './prompt-kit.js';
import { isFigmaUrl } from '../utils/links.js';

const CONNECTOR =
  "en utilisant le connecteur Figma (MCP) s'il est disponible. S'il ne l'est pas, produis une spécification assez précise pour être reproduite telle quelle dans Figma.";

function intro(figmaLinks) {
  if (!figmaLinks.length) {
    return `Tu es designer UI/UX senior. Réalise dans Figma le design décrit ci-dessous, ${CONNECTOR}`;
  }
  const files = figmaLinks.map((url) => `- ${url}`).join('\n');
  return [
    `Tu es designer UI/UX senior. Travaille dans le fichier Figma existant ci-dessous (ne crée pas de nouveau fichier), ${CONNECTOR}`,
    '',
    `Fichier Figma de travail :\n${files}`,
    '',
    "Si le lien contient un node-id, concentre-toi sur ce cadre. Commence par lire le fichier (styles, composants et variables existants) et réutilise-les plutôt que d'en créer de nouveaux.",
  ].join('\n');
}

/** @type {import('./registry.js').Workflow} */
export default Object.freeze({
  id: 'figma',
  command: '/figma',
  labelKey: 'workflowFigma',
  label: 'Design Figma',
  icon: 'figma',
  /** What ChatGPT must prepare for Claude when the message starts with the command. */
  chatgptHint:
    "brief de design. Claude a accès à Figma (connecteur MCP) et peut créer ou modifier mes fichiers : décris l'écran, la structure, les composants et les textes exacts ; recopie tels quels les liens Figma.",
  transform: ({ text, prompt, notes }) => {
    const links = linksOf(prompt);
    const figmaLinks = links.filter(isFigmaUrl);
    return composePrompt({
      intro: intro(figmaLinks),
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
            'Termine par un résumé : écrans créés, composants, variables, et points à valider avec moi.',
            'Si une information manque, fais une hypothèse raisonnable et signale-la.',
          ],
        },
      ],
      contentLabel: 'Brief (préparé avec ChatGPT)',
      content: text,
      notes,
      prompt,
      excludeLinks: figmaLinks, // already in the intro
    });
  },
});
