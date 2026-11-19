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
  /**
   * Personal instructions used until the user edits them in the options
   * (Réglages → Consignes personnelles). [Bracketed] parts are to be completed.
   */
  defaultNotes:
    "- Mon profil : designer UX/UI / Product Designer, [X ans d'expérience], outils : Figma, [autres]. Portfolio : [lien]. Je cherche : [CDI / freelance / alternance], [ville ou télétravail].\n- Écris la lettre à la première personne, dans un ton direct, sincère et concret. Pas de formules creuses (« je me permets », « passionné depuis toujours »).\n- Appuie chaque point fort sur un exemple de projet réel tiré de ce que je fournis. Si je n'en fournis pas, liste les exemples à ajouter.\n- Rédige dans la langue de l'offre (français ou anglais).\n- Termine par une liste « À vérifier avant d'envoyer » : nom du recruteur, chiffres, liens.",
  /** What ChatGPT must prepare for Claude when the message starts with the command. */
  chatgptHint:
    'brief de candidature : poste, entreprise, offre, éléments de mon profil à valoriser.',
  transform: ({ text, prompt, notes }) =>
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
      prompt,
    }),
});
