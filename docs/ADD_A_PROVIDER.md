# Ajouter une IA (Gemini, Grok, Perplexity…)

Une IA est un **provider**. Elle peut être **source** (on lit ses réponses, comme ChatGPT), **cible** (on lui envoie un texte, comme Claude), ou les deux. Tout ce qui dépend du site se trouve dans `src/providers/<id>/`. Le pipeline, le background et l'interface n'en dépendent pas.

Exemple ci-dessous : **Gemini comme destination**.

## 1. Métadonnées — `src/providers/gemini/index.js`

```js
export default Object.freeze({
  id: 'gemini',
  name: 'Gemini',
  matches: ['https://gemini.google.com/*'],     // patterns Chrome
  newChatUrl: 'https://gemini.google.com/app',  // page « nouvelle conversation »
  roles: Object.freeze(['target']),             // 'source' et/ou 'target'
  adapterPath: 'src/providers/gemini/adapter.js',
});
```

Ce fichier ne touche pas au DOM : il est chargé par le service worker.

## 2. Sélecteurs — `src/providers/gemini/selectors.js`

Toutes les hypothèses sur la page sont réunies dans un seul fichier, sous forme de listes ordonnées : du plus stable (attribut de test, `aria-label`) au plus générique.

```js
export const SELECTORS = Object.freeze({
  editor: ['rich-textarea .ql-editor[contenteditable="true"]', '[contenteditable="true"][role="textbox"]'],
  sendButton: ['button[aria-label*="Envoyer" i]', 'button[aria-label*="Send" i]'],
  composer: ['form', 'footer'],
  loginForm: ['a[href*="accounts.google.com"]'],
});
export const AUTH_PATHS = Object.freeze([]);
export const RATE_LIMIT_PATTERNS = Object.freeze([/limit/i]);
```

Pour les trouver sur le vrai site : clic droit sur la zone de saisie → **Inspecter**. Le diagnostic anonyme de la popup (`utils/dom-skeleton.js`) aide aussi.

## 3. Logique — `writer.js` (cible) et/ou `reader.js` (source)

**Cible.** Rien à écrire : `providers/shared/composer.js` contient l'écrivain générique (attente de l'éditeur, insertion vérifiée, envoi confirmé, détection connexion/limite) et le diagnostic. Il suffit de lui passer les sélecteurs (voir l'étape 4 : Claude et Copilot sont configurés ainsi). Il s'appuie sur :

- `utils/rich-text-input.js → insertIntoEditor` : collage simulé, puis `execCommand`, puis réécriture du DOM, avec vérification à chaque essai. Fonctionne avec ProseMirror, Quill, Lexical… ;
- `utils/dom.js` : `waitForElement`, `queryFirst`, `isEnabled`.

**Source.** Copier `providers/chatgpt/reader.js`. Décrire une ou plusieurs mises en page (`LAYOUTS`) : échange, bloc de réponse, message utilisateur, attributs d'identifiant. La conversion utilise `utils/html-to-markdown.js`.

## 4. Adaptateur — `src/providers/gemini/adapter.js`

Pour une cible, trois lignes suffisent :

```js
import { createComposerAdapter } from '../shared/composer.js';
import { SELECTORS, AUTH_PATHS, RATE_LIMIT_PATTERNS } from './selectors.js';

export const createAdapter = createComposerAdapter({
  name: 'Gemini',
  selectors: SELECTORS,
  authPaths: AUTH_PATHS,
  rateLimitPatterns: RATE_LIMIT_PATTERNS,
  chatPages: /^\/app/,            // pages qui doivent montrer un éditeur (bilan de santé)
});
```

Ajouter aussi `aliases: ['gemini']` dans `index.js` : « envoie-le à Gemini » choisira alors cette IA.

Pour une source, il faut aussi gérer `SOURCE_EXTRACT`, et le bouton d'envoi (`mount.js`) si besoin.

`health()`, fourni par le module générique, renvoie `loggedIn`, `editorFound` et `recognized` : la popup affiche l'état en conséquence (« Non connecté », « Page non reconnue »). Si le site redirige vers une page de connexion externe, la préparation de l'onglet le détecte (« non connecté »).

## 5. Enregistrement

- `src/providers/registry.js` : importer le provider et l'ajouter à `PROVIDERS`.
- `manifest.json` : ajouter le pattern dans `host_permissions`, `content_scripts[0].matches` et `web_accessible_resources[0].matches`.

Le provider apparaît alors automatiquement dans la popup (Connexions), et dans les réglages (« IA de destination ») si c'est une cible. Un workflow peut aussi l'imposer : `target: 'gemini'`.

## 6. Tests

- **Unitaires** : `tests/core.test.js` vérifie déjà que chaque provider est complet et que `newChatUrl` correspond à ses patterns.
- **E2E** : ajouter une fixture `tests/e2e/fixtures/gemini.html` et l'hôte dans `HOSTS` de `tests/e2e/harness.cjs`. Le serveur HTTPS local répond alors à la place du vrai site. Ajouter enfin une suite `stepX-gemini.e2e.cjs` sur le modèle de `step2-claude.e2e.cjs` : insertion, envoi, déconnexion, éditeur absent.

> Les sites changent souvent leur interface. Le provider doit donc rester **isolé** et **testé sur une fixture fidèle au DOM réel** : partir d'un diagnostic de la vraie page, pas de suppositions. C'est la leçon de l'étape 3, quand ChatGPT a changé de mise en page.
