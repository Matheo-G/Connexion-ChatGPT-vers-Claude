# Publication sur le Chrome Web Store

Tout ce qu'il faut pour publier : textes de la fiche, justification des permissions, déclaration de confidentialité.

## Paquet

```bash
npm run package        # → dist/matheo-ai-router-<version>.zip
```

Ce `.zip` se dépose tel quel dans la [console développeur du Chrome Web Store](https://chrome.google.com/webstore/devconsole). Il ne contient que le manifeste, les traductions et `src/` : pas de tests, de documentation ni d'outillage.

Avant chaque publication :

1. incrémenter `version` dans `manifest.json` et `package.json` ;
2. `npm run lint && npm test && npm run test:e2e` ;
3. `npm run package`.

## Fiche

- **Nom** : Mathéo AI Router
- **Résumé (132 caractères max.)** : Envoie en un clic les réponses de ChatGPT vers Claude, avec des workflows (/figma, /code…). Sans API, sans coût supplémentaire.
- **Catégorie** : Productivité
- **Langue** : Français
- **Description** :

> Mathéo AI Router transforme ChatGPT en orchestrateur. Sous chaque réponse, un bouton « ➤ Claude » l'envoie dans une nouvelle conversation Claude, en Markdown propre (code, tableaux, listes, formules), sans copier-coller.
>
> • Workflows : commencez votre message par /figma, /code, /video, /job ou /mail. Claude reçoit des instructions adaptées, votre demande d'origine et ses liens (un lien Figma devient le fichier de travail).
> • Raccourci clavier Alt+Maj+C, depuis n'importe quel onglet.
> • Réglages : nouvelle conversation ou conversation existante, envoi automatique ou simple insertion, retour sur ChatGPT, consignes personnelles par workflow.
> • Robuste : nouvel essai automatique sans jamais envoyer deux fois, détection des changements de page, diagnostic anonyme.
> • Privé : aucune API, aucun serveur. Tout se passe dans votre navigateur, avec vos comptes ChatGPT et Claude existants.

- **Captures** (1280×800) : bouton sous une réponse ; menu des workflows ; popup ; réglages. Les captures des tests (`tests/e2e`) servent de base.

## Justification des permissions

| Permission | Pourquoi |
|---|---|
| `storage` | Enregistrer les réglages, l'historique local des envois et les consignes personnelles. |
| `scripting` | Réinjecter le script dans les onglets ChatGPT et Claude déjà ouverts (installation, mise à jour, onglet sans script), pour ne pas obliger l'utilisateur à recharger. |
| Accès à `chatgpt.com`, `chat.openai.com` | Lire la réponse que l'utilisateur choisit d'envoyer et afficher le bouton « ➤ Claude ». |
| Accès à `claude.ai` | Ouvrir ou activer l'onglet Claude, insérer le texte et l'envoyer à la demande de l'utilisateur. |

Pas de `tabs` (l'accès aux sites suffit pour lister leurs onglets), pas de `<all_urls>`, pas de code distant.

## Confidentialité (déclaration et politique)

- **Données collectées** : aucune. L'extension n'a pas de serveur et ne contacte aucun service tiers.
- **Contenu traité** : la réponse ChatGPT que **vous** choisissez d'envoyer, ainsi que votre message d'origine (pour la demande et ses liens). Ils ne vont que de l'onglet ChatGPT à l'onglet Claude, dans votre navigateur, avec vos comptes.
- **Stockage local** : réglages (`chrome.storage.sync`, synchronisés par Chrome avec votre profil), historique des envois limité à un aperçu de 140 caractères et désactivable, consignes personnelles (`chrome.storage.local`). Tout s'efface depuis les réglages ou en désinstallant l'extension.
- **Diagnostic** : le bouton « Copier le diagnostic » produit un squelette de page **sans aucun texte de conversation**, copié dans votre presse-papiers. Rien n'est envoyé automatiquement.

Formulaire « Pratiques de confidentialité » de la console : ne déclarer aucune collecte. Usage unique : router des réponses d'IA de ChatGPT vers Claude.

## Remarque

L'extension automatise l'interface de ChatGPT et de Claude **à la demande explicite de l'utilisateur**, un message à la fois, comme le ferait un copier-coller. Avant une diffusion publique, relire les conditions d'utilisation d'OpenAI et d'Anthropic.
