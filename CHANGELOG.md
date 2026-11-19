# Journal des versions

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
