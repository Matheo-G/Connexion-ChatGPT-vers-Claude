# 🚀 Mathéo AI Router

Extension Chrome (Manifest V3) qui transforme ChatGPT en orchestrateur : un clic envoie une réponse de ChatGPT vers **Claude** ou **Copilot** (Microsoft 365), sans copier-coller, sans API, sans coût supplémentaire.

```
Vous (clavier ou voix) → ChatGPT (prépare) → ➤ Claude / Copilot (exécute : code, Figma via MCP, vidéo, mail…)
```

## Installation

Aucun build, aucun droit administrateur.

1. Récupérer le dossier du projet (ou décompresser `dist/matheo-ai-router-<version>.zip`).
2. Ouvrir `chrome://extensions` et activer le **Mode développeur** (en haut à droite).
3. **Charger l'extension non empaquetée** → sélectionner le dossier qui contient `manifest.json`.
4. Épingler l'icône « Mathéo AI Router » dans la barre d'outils.

La page de réglages s'ouvre alors toute seule. **Faites l'étape « Configurer ChatGPT »** (voir ci-dessous) : sans elle, ChatGPT ne comprend pas les commandes `/figma`, `/code`…

## Configurer ChatGPT (une seule fois)

Dans les réglages de l'extension, première section :

1. **Copier les instructions**.
2. Dans ChatGPT : **Paramètres → Personnalisation → Instructions personnalisées**, champ sur la façon dont ChatGPT doit répondre. On peut aussi utiliser les instructions d'un Projet ChatGPT.
3. Coller, enregistrer, démarrer une nouvelle conversation.

ChatGPT sait alors que `/figma …` signifie « rédige un brief pour Claude », au lieu de tenter la tâche lui-même.

## Utilisation

1. Discutez avec ChatGPT, avec ou sans commande (`/figma`, `/code`…).
2. Sous la réponse voulue, cliquez sur **➤ Claude**. Le bouton suit la progression : *Lecture… → Ouverture… → Envoi… → Envoyé*.
3. Claude s'ouvre, ou s'active s'il était déjà ouvert, et reçoit la réponse en Markdown propre : code, tableaux, listes, formules.

| Raccourci | Effet |
|---|---|
| **Alt+Maj+C** | Envoie la dernière réponse de ChatGPT, depuis n'importe quel onglet. Modifiable dans `chrome://extensions/shortcuts`. |

### Workflows

Commencez votre message à ChatGPT par une commande. Le bouton affiche alors un badge (**➤ Claude `/figma`**), et Claude reçoit des instructions adaptées.

| Commande | Ce que fait Claude |
|---|---|
| *(aucune)* | Reçoit la réponse telle quelle |
| `/figma` | Crée le design dans Figma (connecteur Figma MCP) ou une spécification détaillée. **Un lien Figma devient le fichier de travail.** |
| `/code` | Développe, avec fichiers complets, gestion des erreurs et tests |
| `/video` | Découpe en plans, avec des prompts Higgsfield en anglais |
| `/job` | Prépare une candidature : analyse, mots-clés, lettre, entretien, sans rien inventer |
| `/mail` | Rédige un e-mail prêt à envoyer, en deux versions |

- **Votre demande d'origine et ses liens** sont toujours transmis à Claude, en plus de la réponse de ChatGPT, et c'est votre demande qui prime.
- La flèche **▾** du bouton permet de choisir **la destination** (Claude, Copilot) **ou un autre workflow** pour une réponse.
- **Routage vocal** : terminez votre message par « …, envoie-le à Copilot » (ou « …dans Claude ») et le bouton visera cette IA. La phrase n'est pas transmise à l'IA.
- Réglages → **Consignes personnelles par workflow** : des consignes par défaut sont fournies pour chaque workflow. Modifiez-les, videz-les ou rétablissez-les ; les [champs à compléter] sont signalés.

### Popup et réglages

- **Popup** : envoi de la dernière réponse, état des connexions, 5 derniers envois, outils de diagnostic.
- **Réglages** :
  - nouvelle conversation ou conversation existante ;
  - envoi automatique ou simple insertion ;
  - retour sur ChatGPT ;
  - workflow par défaut et détection des commandes ;
  - thème ;
  - historique ;
  - patience (connexion lente) ;
  - mode debug.

## En cas de problème

| Symptôme | Que faire |
|---|---|
| Pas de bouton sous les réponses | Popup → Connexions. Si « Page non reconnue » : *Outils de diagnostic → Copier le diagnostic ChatGPT* et l'envoyer (le diagnostic ne contient aucun texte de conversation). |
| « Vous n'êtes pas connecté » | Se connecter à claude.ai ou à copilot.cloud.microsoft dans ce navigateur. |
| Copilot : le texte n'arrive pas | Popup → Outils de diagnostic → **Copier le diagnostic Copilot** (structure seule, sans texte) et l'envoyer. |
| Connexions « Indisponible » | `chrome://extensions` → ⟳ sur l'extension, puis bouton **Erreurs** si besoin. Le message technique s'affiche dans la popup. |
| ChatGPT répond « je ne peux pas » à `/figma` | Faire l'étape **Configurer ChatGPT**. |
| Connexion lente, délais dépassés | Réglages → Avancé → Patience : **Connexion lente**. |

Après une mise à jour de l'extension (⟳), les onglets ChatGPT et Claude ouverts reçoivent la nouvelle version automatiquement.

## Confidentialité

Aucune API ni aucun serveur. Les réponses vont de votre onglet ChatGPT à votre onglet Claude, dans votre navigateur et avec vos comptes. Seuls les réglages et un historique local (aperçu de 140 caractères, désactivable) sont conservés. Détails : [docs/STORE.md](docs/STORE.md#confidentialité-déclaration-et-politique).

## Développement

Node ≥ 20 sert uniquement aux tests et aux outils, pas à l'utilisation.

```bash
npm install          # dépendances de développement
npm run lint         # ESLint
npm test             # tests unitaires (node:test)
npm run test:e2e     # bout en bout dans Chromium (Playwright) : fixtures fidèles au DOM réel, accessibilité axe-core
npm run package      # dist/matheo-ai-router-<version>.zip, prêt pour le Chrome Web Store
npm run icons        # régénère les icônes PNG
```

Pour tester le paquet lui-même : `EXTENSION_DIR=<dossier décompressé> npm run test:e2e`.

Logs détaillés : Réglages → **Mode debug**, puis console du service worker (`chrome://extensions` → « service worker ») ou console de la page.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) : principes, rôle de chaque dossier, conventions, choix techniques étape par étape
- [Ajouter un workflow](docs/ADD_A_WORKFLOW.md) : un fichier et deux lignes
- [Ajouter une IA](docs/ADD_A_PROVIDER.md) : Gemini, Grok…
- [Publier sur le Chrome Web Store](docs/STORE.md) : fiche, permissions, confidentialité
- [Journal des versions](CHANGELOG.md)
