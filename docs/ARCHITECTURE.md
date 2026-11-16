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

## Lecture d'une IA source (étape 3)

`background/source-session.js → readSource(providerId, { tabId, messageId })` choisit l'onglet source : celui de l'expéditeur s'il appartient bien au site, sinon le meilleur onglet ouvert. Il envoie ensuite `SOURCE_EXTRACT` à l'adaptateur.

Côté page (`providers/chatgpt/reader.js`) :

- **Plusieurs mises en page** (`LAYOUTS` dans `selectors.js`), détectées automatiquement. ChatGPT sert des structures différentes selon les comptes :
  - `turn-key` : mise en page « Chat / Work » déployée depuis septembre 2026 (`[data-turn-key]`, `[data-user-message-bubble]`, `[data-chatgpt-selection-message-id]`, sans `.markdown`) ;
  - `author-role` : mise en page classique (`[data-message-author-role]`, `.markdown`).
- **Pièges gérés** : conversations précédentes gardées dans la page sous `display: none` (seuls les éléments affichés comptent), fil rendu en double (dédoublonnage par identifiant).
- **Quelle réponse ?** Tous les blocs de réponse du **dernier échange**, joints dans l'ordre : une réponse peut être découpée autour d'un appel d'outil. Avec `messageId`, une réponse précise, pour le bouton placé sous chaque message à l'étape 4.
- **En cours d'écriture ?** Bouton « Stop » du composer (avec ou sans `data-testid`), ou marqueur de streaming → `STILL_GENERATING`. On refuse toujours de lire la « dernière » réponse pendant l'écriture : la réponse en cours peut ne pas encore être reconnaissable, et on enverrait sans le dire la précédente. Une réponse plus ancienne, demandée par identifiant, reste lisible.
- **Résultat** : `{ markdown, prompt, messageId, length }`. `prompt` est le message utilisateur qui a précédé la réponse ; il servira à détecter `/figma`, `/code`… à l'étape 7.

**Diagnostic anonyme** (`providers/chatgpt/diagnostics.js`, `utils/dom-skeleton.js`), bouton dans la popup. Il copie la mise en page reconnue, le nombre d'éléments trouvés pour chaque marqueur et le squelette des derniers échanges : balises, classes, attributs techniques, longueur des textes. **Jamais le texte**, et les valeurs d'attributs qui pourraient contenir du contenu sont masquées. C'est ce qu'il faut envoyer quand ChatGPT change de structure.

`utils/html-to-markdown.js` (générique, testé unitairement) convertit le HTML rendu en Markdown : titres, gras/italique/barré, code inline, blocs de code avec langage (sans l'en-tête « Copier le code »), listes imbriquées et numérotées, citations, tableaux, liens sûrs, images http, maths KaTeX ou `data-math-source` (`$…$`, `$$…$$`), lignes de code de type CodeMirror. L'interface du site est ignorée : boutons, SVG, pastilles de citation, textes `sr-only`.

## V1 : bouton, pipeline, raccourci (étape 4)

**Pipeline** (`background/pipeline.js → runPipeline`) : Source → Workflow → Cible → Post-actions.

1. `readSource` lit la réponse (dernière, ou celle du bouton cliqué) ;
2. `workflow.transform({ text, prompt })` la prépare (`workflows/`, seul `default` pour l'instant) ;
3. `deliverText` ouvre ou active Claude, insère et envoie ;
4. retour éventuel sur ChatGPT (`returnToSource`).

Chaque étape est signalée à l'onglet source (`PIPELINE_STATUS`) pour l'interface. Un même envoi ne peut pas tourner deux fois en parallèle (`BUSY`). Les réglages viennent de `services/settings.js` (stockage `sync`, toujours fusionné avec `DEFAULT_SETTINGS`).

**Déclencheurs**

- **Bouton** sous chaque réponse (`providers/chatgpt/mount.js`) → `ROUTE_REQUEST`. Un `MutationObserver` (anti-rebond de 150 ms) rescanne la page. Le scan est idempotent : un bouton par barre d'actions, recréé si React l'efface ou si le fil virtualisé démonte puis remonte un échange. Pas de bouton sur une réponse en cours d'écriture, puisque sa barre d'actions n'existe pas encore.
- **Raccourci** `Alt+Maj+C` (`background/commands.js`, modifiable dans `chrome://extensions/shortcuts`) : dernière réponse de l'onglet ChatGPT actif, ou du plus pertinent.

**Interface injectée** (`content/ui/`), dans un **Shadow DOM** : le CSS de la page et le nôtre ne se mélangent pas. Les design tokens sont réécrits de `:root` vers `:host`. Le thème suit celui de la page (`html.dark`).

- `send-button.js` : bouton scindé « ➤ Claude | ▾ ». Le menu des workflows reste caché tant qu'il n'y en a qu'un. États `idle → busy (étape en cours) → success | error`.
- `toast.js` : notifications en bas à droite, avec bouton « Réessayer » en cas d'erreur. Elles servent aussi aux envois lancés par le raccourci.
- Si l'extension a été rechargée, l'ancien script de la page est orphelin. Le bouton propose alors de recharger la page au lieu d'échouer en silence.

## Réglages, historique, popup (étape 5)

- **Réglages** (`services/settings.js`) : `chrome.storage.sync`, donc ils suivent le profil Chrome. Toute lecture passe par `sanitizeSettings` : clés inconnues ignorées, mauvais types et valeurs hors liste remplacés par les valeurs par défaut. Une donnée corrompue ne peut donc jamais atteindre le code. `onSettingsChanged` synchronise toutes les pages ouvertes.
- **Page de réglages** générée depuis `options/settings-schema.js`. Ajouter un réglage revient à mettre sa valeur par défaut dans `shared/defaults.js` et à ajouter une ligne au schéma (types `toggle`, `select`, `segmented`). Enregistrement immédiat (« Enregistré ✓ »). Les actions destructives (effacer l'historique, réinitialiser) demandent un second clic, sans boîte de dialogue bloquante.
- **Historique** (`services/history.js`) : `chrome.storage.local`, 50 entrées maximum. On ne garde qu'un **aperçu de 140 caractères**, jamais la réponse complète. Désactivable. Les écritures sont sérialisées, et une erreur d'historique ne fait jamais échouer un envoi.
- **Popup** : envoi rapide de la dernière réponse en tête, connexions, 5 derniers envois (avec lien vers la conversation Claude), outils de diagnostic repliés. Elle est découpée en modules : `feedback.js`, `status-list.js`, `history-list.js`.
- **Thème** des pages de l'extension (`ui-kit/theme.js`) : système, clair ou sombre. Le bouton dans ChatGPT suit toujours le thème de ChatGPT.
- **Styles partagés** : `ui-kit/controls.css` (boutons, interrupteurs, listes, sélecteur segmenté, touches).

## Robustesse (étape 6)

- **Nouvel essai automatique sans double envoi** (`background/delivery.js`). Une tentative qui échoue est refaite **une fois**, sur une page « nouvelle conversation » rechargée (`fresh`), seulement si l'on est **certain que rien n'est parti** :
  - échec pendant la préparation de l'onglet ;
  - éditeur introuvable ;
  - insertion impossible.

  Un délai dépassé *après* l'envoi n'est jamais refait. Une erreur permanente (déconnexion, limite d'usage) non plus. La règle est dans `isSafeToRetry`, testée unitairement. Ce mécanisme couvre aussi une conversation existante disparue.
- **Keep-alive** (`background/keepalive.js`) : pendant un envoi, un appel d'API toutes les 20 s empêche Chrome de suspendre le service worker en plein travail.
- **Patience** (réglage *Avancé*) : « Connexion lente » double tous les délais (`scaleTimeouts`), transmis jusqu'à la page Claude. Les interfaces attendent au plus `Timeouts.CALLER`.
- **Mises à jour sans rechargement** : à l'installation ou à la mise à jour, le script est réinjecté dans les onglets ChatGPT et Claude ouverts (`injectIntoOpenTabs`). Le nouveau script remplace l'interface de l'ancien, devenu orphelin.
- **Bilan de santé** : chaque adaptateur indique `recognized`. ChatGPT : une page de conversation sans mise en page connue. Claude : une page de conversation sans éditeur. La popup affiche alors « Page non reconnue » et invite à copier le diagnostic. Il en existe désormais un pour ChatGPT et un pour Claude.
- **Fenêtre réduite** : elle est restaurée avant d'afficher l'onglet Claude.

## Tests

- `npm test` : tests unitaires des modules purs (`node:test`, aucune dépendance).
- `npm run test:e2e` : Chromium avec l'extension chargée. claude.ai et chatgpt.com sont servis par un serveur HTTPS local (`--host-resolver-rules`), donc pas de réseau ni de compte. La fixture Claude utilise un **vrai éditeur Tiptap/ProseMirror** et simule le chargement lent, la déconnexion, la limite d'usage, un collage ignoré, un bouton cassé… La fixture ChatGPT reproduit la structure de chatgpt.com : tours, en-tête de code, KaTeX, streaming, réponse découpée. Nécessite Playwright, et `npm install` pour les dépendances de développement (Tiptap, esbuild, linkedom).

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
| 3 | Adaptateur ChatGPT (extraction + Markdown) | ✅ |
| 4 | Pipeline + bouton injecté → **V1** | ✅ |
| 5 | Popup + options | ✅ |
| 6 | Robustesse et cas limites | ✅ |
| 7 | Moteur de workflows | ⏳ |
| 8 | Finitions + docs d'extension | |
