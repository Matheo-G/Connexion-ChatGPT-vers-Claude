# Journal des versions

## 1.2.0 — Retour vers ChatGPT (étape 9)

- **Bouton « ↩ ChatGPT »** sous chaque réponse de Claude : la réponse repart dans **la conversation ChatGPT d'origine** du brief (même si d'autres onglets ChatGPT ont été ouverts depuis, ou si elle a été fermée : elle est rouverte), précédée de « ↩ Retour de Claude · /commande ».
- Lecture de Claude en Markdown : texte avant et après les appels d'outils (Figma…) joint, réflexions et outils ignorés, artefacts mentionnés par leur titre. Pas de bouton tant que Claude écrit.
- ChatGPT peut recevoir du texte (insertion vérifiée, envoi selon le réglage « Envoi automatique »). Refus clair, sans rien taper, si ChatGPT est encore en train de répondre.
- Diagnostic Claude enrichi : structure de la conversation (marqueurs, `data-testid`, dernier échange), toujours sans texte.

## 1.1.0 — Copilot, choix de la destination, routage vocal, consignes par défaut

- **Copilot** (Microsoft 365 Copilot Chat, `copilot.cloud.microsoft`) comme destination. Son éditeur Lexical n'accepte qu'un collage : le collage sélectionne d'abord le contenu, puis synchronise la sélection. Une redirection vers la connexion Microsoft donne « non connecté », sans nouvel essai.
- **Destination générique** : `providers/shared/composer.js` (écrivain, diagnostic, adaptateur). Claude et Copilot ne sont plus que des configurations, et une nouvelle IA cible ne demande qu'un fichier de sélecteurs.
- **Choix au clic** : le menu ▾ propose « Envoyer vers » (Claude, Copilot) puis « Workflow ».
- **Routage vocal** : « …, envoie-le à Copilot » dans le message ChatGPT choisit la destination (affichée sur le bouton). La phrase est retirée de la demande transmise. ChatGPT reçoit la consigne de ne pas en parler dans son brief. Les simples mentions (« écris à Claude, ma collègue ») ne déclenchent rien.
- **Consignes par défaut** pour /figma, /code, /video, /job, /mail. Elles restent modifiables, peuvent être vidées (choix respecté) et se rétablissent d'un clic. Les champs [à compléter] sont signalés.
- `[hidden]` cache toujours, même sur un bouton stylé.


## 1.0.0 — Finitions (étape 8)

- **Revue de code** : ESLint strict (`npm run lint`), code mort supprimé, fonctions internes rendues privées. Corrections :
  - réglage invalide (IA ou workflow inconnus) neutralisé au lieu de bloquer la popup, les boutons et les envois ;
  - délai d'attente de l'interface aligné sur le pire cas (« Connexion lente » + nouvel essai) ;
  - verrou anti-doublon sur la réponse réellement lue : bouton et raccourci simultanés n'envoient qu'une fois ;
  - envoi rapide de la popup : « insérée » quand l'envoi automatique est désactivé ;
  - réponses sans identifiant principal : identifiant de secours, plus de bouton qui enverrait la mauvaise réponse ;
  - repli `execCommand` d'un seul bloc, sans `insertParagraph` qui pouvait déclencher l'envoi ;
  - champ e-mail avant l'éditeur : délai de grâce avant de conclure « non connecté » ;
  - pièce jointe déjà présente dans Claude : elle ne simule plus une insertion réussie ;
  - les boutons ne sont recréés que si un réglage qui les concerne change.
- **Accessibilité** : audit axe-core (WCAG 2 A/AA) intégré aux tests, en clair et en sombre, sur la popup, les réglages, le bouton, le menu et les notifications. Couleurs ajustées (contraste ≥ 4,5:1), noms accessibles alignés sur le texte visible, thème du bouton déduit de la page.
- **Paquet** : `npm run package` produit un `.zip` (79 fichiers, ~117 Ko) prêt pour le Chrome Web Store. Il est vérifié en rejouant les tests sur le paquet décompressé.
- **Documentation** : README final, guides « Ajouter une IA » et « Publier sur le Chrome Web Store ».

## 0.8.x — Workflows

- `/figma`, `/code`, `/video`, `/job`, `/mail`, avec badge sur le bouton, menu ▾ et consignes personnelles.
- Instructions à coller une fois dans ChatGPT, pour qu'il rédige des briefs au lieu de refuser.
- Demande d'origine et liens toujours transmis à Claude ; un lien Figma devient le fichier de travail.
- Popup : les connexions ne restent plus en vérification sans fin (« Indisponible » + erreur exacte + Réessayer).

## 0.7.0 — Robustesse

Nouvel essai automatique sans double envoi, keep-alive, réglage Patience, réinjection après mise à jour, bilan de santé « Page non reconnue », diagnostic Claude.

## 0.6.0 — Réglages, popup, historique

## 0.5.0 — V1 : bouton « ➤ Claude », pipeline, raccourci Alt+Maj+C

## 0.4.x — Lecture de ChatGPT en Markdown (deux mises en page, dont « Chat / Work »)

## 0.3.0 — Écriture et envoi dans Claude

## 0.2.0 — Messagerie, onglets, injection

## 0.1.0 — Fondations
