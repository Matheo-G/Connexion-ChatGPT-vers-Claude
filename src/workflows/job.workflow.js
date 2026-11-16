/**
 * @file /job — job search: tailor an application to an offer, honestly.
 */

import { composePrompt } from './prompt-kit.js';

/** @type {import('./registry.js').Workflow} */
export default Object.freeze({
  id: 'job',
  command: '/job',
  labelKey: 'workflowJob',
  label: "Recherche d'emploi",
  icon: 'briefcase',
  transform: ({ text, notes }) =>
    composePrompt({
      intro:
        'Tu es coach carrière et recruteur expérimenté. Aide-moi à préparer une candidature solide à partir des éléments ci-dessous.',
      sections: [
        {
          title: 'À produire',
          items: [
            "Analyse de l'offre : missions clés, compétences attendues, mots-clés ATS.",
            'Correspondance avec mon profil : points forts à mettre en avant, écarts et comment les présenter.',
            'Lettre de motivation concise (250 mots maximum), personnalisée pour l’entreprise.',
            "Trois questions d'entretien probables, avec des pistes de réponse.",
          ],
        },
        {
          title: 'Règles',
          items: [
            "N'invente jamais d'expérience, de diplôme ou de chiffre : signale ce qui manque.",
            'Ton professionnel, direct et chaleureux, en français.',
          ],
        },
      ],
      contentLabel: 'Éléments (préparés avec ChatGPT)',
      content: text,
      notes,
    }),
});
