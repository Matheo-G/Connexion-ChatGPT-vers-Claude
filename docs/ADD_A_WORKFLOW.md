# Ajouter un workflow

Un workflow transforme la réponse de ChatGPT avant de l'envoyer à l'IA de destination, par exemple en l'encadrant d'instructions pour Figma. **Ajouter un workflow = 1 fichier + 2 lignes.**

## 1. Créer le fichier

Copier `src/workflows/_template.workflow.js` vers `src/workflows/<id>.workflow.js` :

```js
import { composePrompt } from './prompt-kit.js';

export default Object.freeze({
  id: 'linkedin',                 // unique, en minuscules
  command: '/linkedin',           // commande tapée au début d'un message ChatGPT (ou null)
  labelKey: 'workflowLinkedin',   // nom traduit (étape 3)
  label: 'Post LinkedIn',         // nom de secours
  icon: 'sparkles',               // une icône de src/ui-kit/icons.js
  // target: 'claude',            // facultatif : une autre IA de destination
  // options: { autoSend: false },// facultatif : surcharge des réglages pour ce workflow
  transform: ({ text, prompt, notes }) =>
    composePrompt({
      intro: 'Tu es expert en communication LinkedIn. Transforme ce contenu en post.',
      sections: [
        { title: 'Format', items: ['Accroche forte en une ligne.', '3 à 5 paragraphes courts.', '3 hashtags pertinents.'] },
      ],
      contentLabel: 'Contenu (préparé avec ChatGPT)',
      content: text,
      notes,
    }),
});
```

- `text` : la réponse de ChatGPT, en Markdown. **Ne jamais la modifier** : on l'encadre seulement.
- `prompt` : votre message à ChatGPT (utile pour adapter la consigne).
- `notes` : vos consignes personnelles, saisies dans les réglages (`composePrompt` les ajoute en fin de prompt).

## 2. L'enregistrer

Dans `src/workflows/registry.js` :

```js
import linkedin from './linkedin.workflow.js';
const WORKFLOWS = Object.freeze([defaultWorkflow, figma, code, video, job, mail, linkedin]);
```

## 3. Lui donner un nom

Dans `_locales/fr/messages.json` :

```json
"workflowLinkedin": { "message": "Post LinkedIn" }
```

## C'est tout

Le workflow apparaît automatiquement :

- dans le menu ▾ du bouton sous chaque réponse ;
- dans les réglages, comme workflow par défaut possible et avec sa zone de consignes personnelles ;
- dans l'historique de la popup ;
- et il est sélectionné dès qu'un message ChatGPT commence par sa commande (`/linkedin …`).

Les tests unitaires (`npm test`) vérifient que chaque workflow a un identifiant et une commande uniques, un nom traduit et une icône connue, qu'il garde la réponse intacte et qu'il intègre les consignes personnelles.
