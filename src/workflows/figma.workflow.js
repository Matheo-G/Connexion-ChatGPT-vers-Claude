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
  /**
   * Personal instructions used until the user edits them in the options
   * (Réglages → Consignes personnelles). [Bracketed] parts are to be completed.
   */
  defaultNotes:
    "Agis directement dans Figma via le connecteur MCP, sans me demander de reproduire quoi que ce soit à la main.\n- Si je donne un lien avec node-id, travaille uniquement dans cette frame. Ne modifie, ne déplace et ne supprime jamais les autres frames ou calques.\n- Sans lien précis, crée une nouvelle frame à côté de l'existant, nommée « IA · <sujet> », plutôt que de modifier mes écrans.\n- Réutilise en priorité les composants, styles de texte, couleurs et variables du fichier. N'en crée de nouveaux que si rien n'existe, et dis-le.\n- Projet principal : Jalonet, app mobile. Format de base : [iPhone 393×852]. Textes en français sauf mention contraire.\n- Nomme les calques selon la convention déjà utilisée dans le fichier.\n- Pour une demande simple (écrire un texte, changer une couleur), fais-la sans proposer d'alternatives.\n- À la fin, résume en 3 lignes maximum ce que tu as modifié, avec le nom des frames.\n- Si le connecteur Figma n'est pas disponible, dis-le en une phrase dès le début.",
  /** What ChatGPT must prepare for Claude when the message starts with the command. */
  chatgptHint:
    "brief de design. L'IA a accès à Figma (connecteur MCP) et peut créer ou modifier mes fichiers : décris l'écran, la structure, les composants et les textes exacts ; recopie tels quels les liens Figma.",
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
