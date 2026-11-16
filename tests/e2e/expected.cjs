/**
 * Markdown the rich fixture answer must become (both ChatGPT layouts).
 * Shared by the step 3 (reading) and step 4 (button → Claude) suites.
 */

const EXPECTED = [
  '## Écran de connexion',
  '',
  'Voici un prompt **optimisé** pour *Figma*, avec `Auto Layout`. Source [Figma Help](https://help.figma.com).',
  '',
  '```javascript',
  'const frame = figma.createFrame();',
  'frame.layoutMode = "VERTICAL";',
  '```',
  '',
  '- Champs',
  '  - Email',
  '  - Mot de passe',
  '- Bouton **Continuer**',
  '',
  '| Élément | Espacement |',
  '| --- | --- |',
  '| Champ | 16 px |',
  '| Bouton | 24 px |',
  '',
  'Ratio : $\\frac{16}{9}$',
  '',
  '> Garde une palette sobre.',
].join('\n');

/** ProseMirror (Claude) turns each line into a paragraph and drops empty lines. */
const nonEmptyLines = (text) => text.split('\n').filter((line) => line.trim());

module.exports = { EXPECTED, nonEmptyLines };
