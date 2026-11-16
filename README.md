# 🚀 Mathéo AI Router

Extension Chrome (Manifest V3) qui transforme ChatGPT en orchestrateur : un clic envoie la dernière réponse de ChatGPT vers Claude, sans copier-coller, sans API, sans coût supplémentaire.

> **État :** V1 (étape 4). Un bouton **➤ Claude** apparaît sous chaque réponse de ChatGPT. Un clic envoie la réponse, en Markdown propre, dans une nouvelle conversation Claude. Raccourci : **Alt+Maj+C** pour la dernière réponse.

## Utilisation

1. Discutez normalement avec ChatGPT.
2. Sous la réponse qui vous convient, cliquez sur **➤ Claude**. Le bouton indique la progression : *Lecture… → Ouverture… → Envoi… → Envoyé*.
3. Claude s'ouvre, ou s'active s'il était déjà ouvert, et reçoit la réponse.

Raccourci clavier : **Alt+Maj+C**, depuis n'importe quel onglet. Il est modifiable dans `chrome://extensions/shortcuts`.

### Workflows

Commencez votre message à ChatGPT par une commande, et la réponse partira vers Claude avec les bonnes instructions. Le bouton affiche alors un badge, par exemple **➤ Claude `/figma`**.

| Commande | Ce que fait Claude |
|---|---|
| `/figma` | Crée le design dans Figma (connecteur Figma MCP) ou une spécification détaillée |
| `/code` | Développe, avec fichiers complets et tests |
| `/video` | Découpe en plans avec des prompts Higgsfield |
| `/job` | Prépare une candidature (analyse, lettre, entretien) |
| `/mail` | Rédige un e-mail prêt à envoyer |

La flèche **▾** du bouton permet de choisir un autre workflow pour une réponse. Dans les réglages, vous pouvez ajouter vos **consignes personnelles** à chaque workflow. Pour créer un nouveau workflow, voir [docs/ADD_A_WORKFLOW.md](docs/ADD_A_WORKFLOW.md).

La **popup** (icône de l'extension) propose aussi l'envoi de la dernière réponse en un clic, l'état des connexions et vos derniers envois. Les **réglages** (roue dentée) permettent de choisir :
- nouvelle conversation ou conversation existante ;
- envoi automatique ou simple insertion ;
- retour sur ChatGPT après l'envoi ;
- le thème ;
- l'historique ;
- le mode debug.

## Installation (mode développeur)

Aucun build, aucun droit administrateur.

1. Ouvrir `chrome://extensions`
2. Activer **Mode développeur** (en haut à droite)
3. **Charger l'extension non empaquetée** → sélectionner ce dossier (celui qui contient `manifest.json`)
4. Épingler l'icône « Mathéo AI Router » dans la barre d'outils

Après une modification du code : bouton ⟳ sur la carte de l'extension. Les onglets ChatGPT et Claude déjà ouverts reçoivent automatiquement la nouvelle version : inutile de les recharger.

## Développement (optionnel)

Node ≥ 20 n'est utile que pour les tests et les outils, pas pour utiliser l'extension.

```bash
npm install       # dépendances de développement (tests e2e uniquement)
npm test          # tests unitaires (node:test, aucune dépendance)
npm run test:e2e  # tests de bout en bout dans Chromium (nécessite Playwright)
npm run icons     # régénère les icônes PNG (nécessite Playwright)
```

Logs détaillés : activer le **Mode debug** dans les réglages, puis ouvrir la console du service worker (`chrome://extensions` → « service worker ») ou celle de la page.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — principes, rôle de chaque dossier, conventions, feuille de route
- [Ajouter un workflow](docs/ADD_A_WORKFLOW.md) — un fichier et deux lignes

## Confidentialité

Tout reste dans le navigateur : aucune donnée n'est envoyée ailleurs que vers les sites d'IA que vous utilisez déjà.
