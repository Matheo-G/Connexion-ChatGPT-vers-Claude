# content/

Runtime injecté dans les pages des IA (ChatGPT, Claude…).

- `loader.js` — script classique déclaré dans le manifest ; charge `runtime.js` en module ES via `import()`.
- `runtime.js` — détecte le site, charge le provider correspondant, répond au handshake.
- `ui/` — interface injectée (bouton, toasts), isolée dans un Shadow DOM.

Ne contient **aucun sélecteur spécifique à un site** : ils vivent dans `providers/`.

_Implémenté aux étapes 1 à 4._
