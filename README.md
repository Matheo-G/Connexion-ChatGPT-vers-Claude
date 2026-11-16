# 🚀 Mathéo AI Router

Extension Chrome (Manifest V3) qui transforme ChatGPT en orchestrateur : un clic envoie la dernière réponse de ChatGPT vers Claude, sans copier-coller, sans API, sans coût supplémentaire.

> **État :** étape 3 — l'extension sait lire la dernière réponse de ChatGPT en Markdown, ouvrir Claude, y insérer un texte et l'envoyer. Tout est testable depuis la popup. Le bouton « Envoyer à Claude » dans ChatGPT arrive à l'étape 4.

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
npm install       # dépendances de développement (tests e2e uniquement)
npm test          # tests unitaires (node:test, aucune dépendance)
npm run test:e2e  # tests de bout en bout dans Chromium (nécessite Playwright)
npm run icons     # régénère les icônes PNG (nécessite Playwright)
```

Logs détaillés : activer le mode debug (réglage `debugMode`, page d'options à l'étape 5), puis ouvrir la console du service worker (`chrome://extensions` → « service worker ») ou celle de la page.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — principes, rôle de chaque dossier, conventions, feuille de route

## Confidentialité

Tout reste dans le navigateur : aucune donnée n'est envoyée ailleurs que vers les sites d'IA que vous utilisez déjà.
