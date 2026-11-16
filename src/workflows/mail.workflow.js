/**
 * @file /mail — writes a ready-to-send e-mail from the given context.
 */

import { composePrompt } from './prompt-kit.js';

/** @type {import('./registry.js').Workflow} */
export default Object.freeze({
  id: 'mail',
  command: '/mail',
  labelKey: 'workflowMail',
  label: "Rédaction d'e-mail",
  icon: 'mail',
  /** What ChatGPT must prepare for Claude when the message starts with the command. */
  chatgptHint:
    "brief d'e-mail : destinataire, objectif, contexte, ton, éléments à inclure.",
  transform: ({ text, prompt, notes }) =>
    composePrompt({
      intro: 'Rédige un e-mail prêt à envoyer à partir du contexte ci-dessous.',
      sections: [
        {
          title: 'Format',
          items: [
            'Objet clair et spécifique.',
            'Corps court : contexte en une phrase, demande ou information principale, prochaine étape.',
            'Formule de politesse adaptée au destinataire.',
            'Propose deux versions : une formelle et une plus directe.',
          ],
        },
        {
          title: 'Règles',
          items: [
            'Ton professionnel et chaleureux, phrases simples, pas de jargon inutile.',
            'Signale entre [crochets] toute information à compléter (date, nom, montant…).',
          ],
        },
      ],
      contentLabel: 'Contexte (préparé avec ChatGPT)',
      content: text,
      notes,
      prompt,
    }),
});
