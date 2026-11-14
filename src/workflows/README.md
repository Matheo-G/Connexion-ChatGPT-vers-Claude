# workflows/

Un fichier par workflow (`/code`, `/figma`, `/mail`…) + `registry.js`.

Un workflow décrit : sa commande, son libellé, son icône, sa cible par défaut,
une fonction `transform(text)` et ses options (nouvelle conversation, envoi auto…).

Ajouter un workflow = copier `_template.workflow.js` et l'enregistrer dans le registre.

_Implémenté à l'étape 7 (le workflow `default` arrive à l'étape 4)._
