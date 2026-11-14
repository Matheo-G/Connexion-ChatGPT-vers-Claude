# Architecture — Mathéo AI Router

## Principe

L'extension est un **routeur de contenu** entre interfaces web d'IA :

```
Source  ──►  Workflow  ──►  Cible  ──►  Post-actions
(ChatGPT)   (transforme)    (Claude)    (retour onglet, historique, toast)
```

Chaque maillon est interchangeable :

- **Provider** : un site d'IA (ChatGPT, Claude, Gemini…). Peut être *source*, *cible*, ou les deux.
- **Workflow** : une transformation du texte (`default`, `/code`, `/figma`…).
- **Pipeline** : l'orchestration, indépendante des sites.

Seul le dossier `providers/` connaît le DOM des sites. Quand un site change, la correction est locale.

## Contextes d'exécution

| Contexte | Dossier | Accès |
|---|---|---|
| Service worker | `src/background/` | API Chrome (tabs, scripting, storage). **Pas de DOM.** Peut être arrêté à tout moment. |
| Content scripts | `src/content/`, `src/providers/` | DOM de la page hôte. API Chrome limitée (runtime, storage). |
| Pages d'extension | `src/popup/`, `src/options/` | DOM propre + API Chrome. |
| Partout | `src/shared/`, `src/utils/`, `src/services/`, `src/workflows/`, `src/ui-kit/` | Modules purs, importables partout. |

## Rôle de chaque dossier

| Dossier | Rôle |
|---|---|
| `background/` | Chef d'orchestre : écoute les événements Chrome, route les messages, gère les onglets, injecte les scripts. Point d'entrée : `service-worker.js`. |
| `content/` | Runtime générique injecté dans les pages : détecte le site, charge le provider, monte l'UI (bouton, toasts) dans un Shadow DOM. |
| `providers/` | Un dossier par IA : métadonnées, sélecteurs CSS (avec fallbacks), lecture (source) et écriture (cible). |
| `workflows/` | Un fichier par workflow + un registre. Ajouter un workflow = un fichier. |
| `services/` | Logique métier : pipeline, messagerie typée, réglages, historique. |
| `shared/` | Contrats communs : types de messages, erreurs, valeurs par défaut. |
| `utils/` | Helpers purs et testés : logger, i18n, DOM, async (timeout/retry), HTML→Markdown. |
| `ui-kit/` | Design system : tokens CSS (dark mode), styles de base, icônes SVG. |
| `popup/` | Popup de la barre d'outils : état, workflow rapide, historique. |
| `options/` | Page de réglages. |
| `assets/` | Ressources statiques (icônes PNG de l'extension). |
| `_locales/` | Textes de l'interface (i18n Chrome). Français par défaut. |

## Conventions

- **Modules ES natifs**, aucun build. Le service worker est en `type: module` ; le content script `content/loader.js` (script classique) importe `content/runtime.js` via `import()`. Les dossiers importés côté page sont listés dans `web_accessible_resources`.
- **Pas d'`import()` dynamique dans le service worker** (interdit par Chrome) : les providers exposent un `adapterPath` (chaîne), chargé uniquement côté page.
- **Messages** : toujours via `MessageType` (`shared/message-types.js`), jamais de chaîne en dur. Enveloppe `{ type, payload, requestId }`, réponse `{ ok, data | error }`.
- **Erreurs** : toujours `RouterError` avec un `ErrorCode`. Sérialisable à travers la messagerie. Le message utilisateur vient de `_locales` (`error_<CODE>`).
- **Logs** : `createLogger('module')`. `debug` n'apparaît qu'en mode debug (réglage `debugMode`).
- **État** : jamais de variable globale critique dans le service worker → `chrome.storage.session`.
- **Textes UI** : `_locales/fr/messages.json` + `data-i18n` dans le HTML.
- **Clés de stockage** : `StorageKey` dans `shared/defaults.js`.

## Préparation d'un onglet cible (étape 1)

`background/target-session.js → prepareTarget(providerId, options)` :

1. **Choix de l'onglet** : avec `newConversation`, on prend un onglet déjà sur la page « nouvelle conversation », sinon le meilleur onglet existant qu'on y navigue, sinon un nouvel onglet ouvert à côté de la source. Sans `newConversation`, on réutilise le meilleur onglet ouvert.
2. **Focus immédiat** (retour visuel instantané), puis attente du chargement. Après une navigation, on attend la **nouvelle** page, pas l'ancienne.
3. **Handshake** : `PING` ; sans réponse (onglet ouvert avant l'installation, extension rechargée), le loader est injecté à la demande, puis on attend une réponse.
4. Le loader est idempotent : une double injection ne lance pas deux runtimes. Une instance orpheline est remplacée proprement (événement `ai-router:teardown`).

Helpers de debug dans la console du service worker : `await aiRouter.prepareTarget('claude', { activate: false })`, `await aiRouter.getStatus()`.

## Écriture dans une IA cible (étape 2)

`background/delivery.js → deliverText(providerId, text, options)` prépare l'onglet (étape 1) puis envoie `TARGET_SUBMIT` à l'adaptateur.

Côté page (`providers/claude/writer.js`) :

1. **Connexion** : écran `/login` ou formulaire e-mail détecté → `TARGET_NOT_LOGGED_IN`, sans attendre.
2. **Éditeur** : attente par `MutationObserver` (fonctionne aussi en onglet d'arrière-plan) → `EDITOR_NOT_FOUND` après 15 s.
3. **Insertion** (`utils/rich-text-input.js`, générique) : les éditeurs riches (ProseMirror, Lexical…) ignorent `innerText`. On essaie, en vérifiant après chaque essai :
   1. `paste` synthétique : la méthode la plus fidèle, qui garde les sauts de ligne et laisse Claude transformer un très long texte en pièce jointe ;
   2. `execCommand('insertText')`, qui imite la frappe ;
   3. réécriture du DOM + événement `input`, en dernier recours.

   Le brouillon éventuel est remplacé, pas complété.
4. **Envoi** : clic sur le bouton d'envoi (cherché d'abord dans le composer, libellé FR ou EN), sinon touche Entrée. On **vérifie** que le message est parti : URL changée, composer vidé, ou bouton désactivé. Sinon `TARGET_RATE_LIMITED` si un bandeau de limite est visible, et `SEND_FAILED` dans les autres cas.

Tous les sélecteurs sont dans `providers/claude/selectors.js`.

## Tests

- `npm test` : tests unitaires des modules purs (`node:test`, aucune dépendance).
- `npm run test:e2e` : Chromium avec l'extension chargée. claude.ai et chatgpt.com sont servis par un serveur HTTPS local (`--host-resolver-rules`), donc pas de réseau ni de compte. La fixture Claude utilise un **vrai éditeur Tiptap/ProseMirror** et simule le chargement lent, la déconnexion, la limite d'usage, un collage ignoré, un bouton cassé… Nécessite Playwright, et `npm install` pour les dépendances de développement (Tiptap, esbuild).

## Flux V1 (cible)

```
[ChatGPT] clic bouton
   │ reader : génération terminée ? → HTML → Markdown
   ▼ ROUTE_REQUEST {text, workflowId, sourceTabId}
[Service worker] pipeline
   │ workflow.transform(text)
   │ tab-manager : onglet Claude ? activer : ouvrir claude.ai/new
   │ attente : tab "complete" + handshake CONTENT_READY
   ▼ TARGET_SUBMIT {text, autoSend}
[Claude] writer : éditeur → insertion → bouton Envoyer actif → clic
   ▼ {ok} | {error}
[Service worker] post-actions → PIPELINE_STATUS → toast côté ChatGPT
```

## Feuille de route

| Étape | Contenu | État |
|---|---|---|
| 0 | Fondations : manifest, structure, logger, erreurs, messages, i18n, design tokens, icônes | ✅ |
| 1 | Messagerie + gestion des onglets + injection + handshake | ✅ |
| 2 | Adaptateur Claude (insertion + envoi) | ✅ |
| 3 | Adaptateur ChatGPT (extraction + Markdown) | ⏳ |
| 4 | Pipeline + bouton injecté → **V1** | |
| 5 | Popup + options | |
| 6 | Robustesse et cas limites | |
| 7 | Moteur de workflows | |
| 8 | Finitions + docs d'extension | |
