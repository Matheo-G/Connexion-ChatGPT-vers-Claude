# workflows/

Un fichier par workflow : ce que devient la réponse de ChatGPT avant d'arriver à Claude.

- `registry.js` : liste, détection des commandes (`/figma`…) et règle de priorité ;
- `prompt-kit.js` : `composePrompt`, la forme commune des prompts ;
- `<id>.workflow.js` : `default`, `figma`, `code`, `video`, `job`, `mail` ;
- `_template.workflow.js` : le modèle à copier.

Guide : [docs/ADD_A_WORKFLOW.md](../../docs/ADD_A_WORKFLOW.md).
