# providers/

Un dossier par IA. C'est **le seul endroit** qui connaît le DOM d'un site.

```
providers/<id>/
  index.js       métadonnées : id, nom, URLs, rôles ('source' | 'target'), adapterPath
  adapter.js     branche les fonctions du site sur le bus de messages
  selectors.js   sélecteurs CSS, plusieurs stratégies de repli par élément
  reader.js      (source) extraire la dernière réponse
  writer.js      (cible)  insérer et envoyer un message
```

Quand un site change son HTML, seule la mise à jour de `selectors.js` est nécessaire.

_Claude : étape 2 ✅ — ChatGPT : étape 3._
