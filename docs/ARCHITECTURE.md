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

- **Modules ES natifs**, aucun build. Le service worker est en `type: module` ; les content scripts passent par un loader qui fait `import()` (étape 1).
- **Messages** : toujours via `MessageType` (`shared/message-types.js`), jamais de chaîne en dur. Enveloppe `{ type, payload, requestId }`, réponse `{ ok, data | error }`.
- **Erreurs** : toujours `RouterError` avec un `ErrorCode`. Sérialisable à travers la messagerie. Le message utilisateur vient de `_locales` (`error_<CODE>`).
- **Logs** : `createLogger('module')`. `debug` n'apparaît qu'en mode debug (réglage `debugMode`).
- **État** : jamais de variable globale critique dans le service worker → `chrome.storage.session`.
- **Textes UI** : `_locales/fr/messages.json` + `data-i18n` dans le HTML.
- **Clés de stockage** : `StorageKey` dans `shared/defaults.js`.

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
| 1 | Messagerie + gestion des onglets + handshake | ⏳ |
| 2 | Adaptateur Claude (insertion + envoi) | |
| 3 | Adaptateur ChatGPT (extraction + Markdown) | |
| 4 | Pipeline + bouton injecté → **V1** | |
| 5 | Popup + options | |
| 6 | Robustesse et cas limites | |
| 7 | Moteur de workflows | |
| 8 | Finitions + docs d'extension | |
