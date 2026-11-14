# 🚀 Mathéo AI Router

Extension Chrome (Manifest V3) qui transforme ChatGPT en orchestrateur : un clic envoie la dernière réponse de ChatGPT vers Claude, sans copier-coller, sans API, sans coût supplémentaire.

> **État :** étape 1 — l'extension sait trouver, ouvrir et préparer un onglet Claude (testable depuis la popup). L'envoi du texte arrive à l'étape 2.

## Installation (mode développeur)

Aucun build, aucun droit administrateur.

1. Ouvrir `chrome://extensions`
2. Activer **Mode développeur** (en haut à droite)
3. **Charger l'extension non empaquetée** → sélectionner ce dossier (celui qui contient `manifest.json`)
4. Épingler l'icône « Mathéo AI Router » dans la barre d'outils

Après une modification du code : bouton ⟳ sur la carte de l'extension, puis recharger les onglets ChatGPT / Claude.

## Développement (optionnel)

Node ≥ 20 n'est utile que pour les tests et les outils, pas pour utiliser l'extension.

```bash
npm test          # tests unitaires (node:test, aucune dépendance)
npm run test:e2e  # tests de bout en bout dans Chromium (nécessite Playwright)
npm run icons     # régénère les icônes PNG (nécessite Playwright)
```

Logs détaillés : activer le mode debug (réglage `debugMode`, page d'options à l'étape 5), puis ouvrir la console du service worker (`chrome://extensions` → « service worker ») ou celle de la page.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — principes, rôle de chaque dossier, conventions, feuille de route

## Confidentialité

Tout reste dans le navigateur : aucune donnée n'est envoyée ailleurs que vers les sites d'IA que vous utilisez déjà.
