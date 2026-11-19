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
  /**
   * Personal instructions used until the user edits them in the options
   * (Réglages → Consignes personnelles). [Bracketed] parts are to be completed.
   */
  defaultNotes:
    "- Vouvoiement par défaut, sauf si le contexte montre que je tutoie la personne.\n- Va droit au but : pas de « J'espère que vous allez bien », une idée par paragraphe, 120 mots maximum sauf demande contraire.\n- Objet de 60 caractères maximum, explicite.\n- Signature : « Mathéo » (ajoute [ton titre / téléphone] pour les e-mails professionnels).\n- Si une réponse est attendue, termine par une question ou une action claire avec une échéance.",
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
