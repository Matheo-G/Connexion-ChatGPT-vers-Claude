# services/

Logique métier réutilisable, indépendante des sites :

- `messaging.js` — bus de messages typé (requête/réponse, timeout, erreurs sérialisées)
- `pipeline.js` — Source → Workflow → Cible → Post-actions
- `settings.js` — préférences utilisateur avec valeurs par défaut
- `history.js` — historique des envois

_Implémenté aux étapes 1, 4 et 5._
