/**
 * Unit tests for utils/html-to-markdown.js, on HTML shaped like ChatGPT's
 * rendered answers (lightweight DOM via linkedom).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { htmlToMarkdown } from '../src/utils/html-to-markdown.js';

const md = (html, options) => {
  const { document } = parseHTML(`<!doctype html><html><body><div id="root">${html}</div></body></html>`);
  return htmlToMarkdown(document.getElementById('root'), options);
};

test('headings, paragraphs and inline formatting', () => {
  assert.equal(
    md('<h2>Titre</h2><p>Du <strong>gras</strong>, de l’<em>italique</em>, <del>barré</del> et <code>npm test</code>.</p>'),
    '## Titre\n\nDu **gras**, de l’*italique*, ~~barré~~ et `npm test`.',
  );
});

test('formatting markers hug the text, spaces stay outside', () => {
  assert.equal(md('<p>a<strong> b </strong>c</p>'), 'a **b** c');
});

test('whitespace from HTML indentation is collapsed', () => {
  assert.equal(md('<p>\n   un\n   texte   indenté\n</p>'), 'un texte indenté');
});

test('line breaks inside a paragraph are kept', () => {
  assert.equal(md('<p>ligne 1<br>ligne 2</p>'), 'ligne 1\nligne 2');
});

test('ChatGPT code block: language kept, header and copy button dropped', () => {
  const html = `
    <pre class="overflow-visible!"><div class="contain-inline-size rounded-2xl">
      <div class="flex items-center">javascript</div>
      <div class="sticky top-9"><button aria-label="Copier"><svg></svg>Copier le code</button></div>
      <div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-javascript"><span><span class="hljs-keyword">function</span> hello() {
  return "monde";
}</span></code></div>
    </div></pre>`;
  assert.equal(md(html), '```javascript\nfunction hello() {\n  return "monde";\n}\n```');
});

test('code containing backtick fences gets a longer fence', () => {
  const out = md('<pre><code class="language-md">```js\nx\n```</code></pre>');
  assert.equal(out, '````md\n```js\nx\n```\n````');
});

test('inline code containing a backtick', () => {
  assert.equal(md('<p><code>a`b</code></p>'), '``a`b``');
});

test('nested lists, ordered lists with start', () => {
  const html = `
    <ul>
      <li>Fruits
        <ul><li>Pomme</li><li>Poire</li></ul>
      </li>
      <li><p>Légumes</p></li>
    </ul>
    <ol start="3"><li>trois</li><li>quatre</li></ol>`;
  assert.equal(md(html), '- Fruits\n  - Pomme\n  - Poire\n- Légumes\n\n3. trois\n4. quatre');
});

test('list item with a code block stays indented under its marker', () => {
  const html = '<ol><li><p>Installer :</p><pre><code class="language-bash">npm i</code></pre></li></ol>';
  assert.equal(md(html), '1. Installer :\n   ```bash\n   npm i\n   ```');
});

test('blockquote with several paragraphs', () => {
  assert.equal(md('<blockquote><p>un</p><p>deux</p></blockquote>'), '> un\n>\n> deux');
});

test('table with header, pipes escaped, short rows padded', () => {
  const html = `
    <table><thead><tr><th>Outil</th><th>Rôle</th></tr></thead>
    <tbody><tr><td>Claude</td><td>a | b</td></tr><tr><td>ChatGPT</td></tr></tbody></table>`;
  assert.equal(
    md(html),
    '| Outil | Rôle |\n| --- | --- |\n| Claude | a \\| b |\n| ChatGPT |  |',
  );
});

test('links, autolinks and unsafe hrefs', () => {
  assert.equal(
    md('<p><a href="https://figma.com">Figma</a> <a href="https://x.dev">https://x.dev</a> <a href="javascript:alert(1)">piège</a></p>'),
    '[Figma](https://figma.com) <https://x.dev> piège',
  );
});

test('images: http kept, data/blob dropped', () => {
  assert.equal(md('<p><img src="https://a.png" alt="schéma"><img src="data:image/png;base64,xx"></p>'), '![schéma](https://a.png)');
});

test('KaTeX inline and display math use the TeX source', () => {
  const katex = (src) =>
    `<span class="katex"><span class="katex-mathml"><math><semantics><mrow></mrow><annotation encoding="application/x-tex">${src}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">rendu</span></span>`;
  const html = `<p>Soit ${katex('x^2')} un carré.</p><span class="katex-display">${katex('\\sum_i x_i')}</span>`;
  assert.equal(md(html), 'Soit $x^2$ un carré.\n\n$$\n\\sum_i x_i\n$$');
});

test('horizontal rule and screen-reader text', () => {
  assert.equal(md('<h6 class="sr-only">ChatGPT a dit :</h6><p>a</p><hr><p>b</p>'), 'a\n\n---\n\nb');
});

test('extra ignore selectors drop site UI', () => {
  assert.equal(
    md('<p>Source <span data-testid="webpage-citation-pill">lemonde.fr</span></p>', {
      ignore: ['[data-testid="webpage-citation-pill"]'],
    }),
    'Source',
  );
});

test('empty content gives an empty string', () => {
  assert.equal(md('<div> <p>  </p> </div>'), '');
});

test('math from data-math-source: inline span and display block', () => {
  const html = '<p>Aire <span data-math-source="\\pi r^2">πr²</span>.</p><div data-math-source="a^2 + b^2 = c^2">rendu</div>';
  assert.equal(md(html), 'Aire $\\pi r^2$.\n\n$$\na^2 + b^2 = c^2\n$$');
});

test('CodeMirror-style code lines are joined with newlines', () => {
  const html = '<pre data-language="python"><div class="cm-content"><div class="cm-line">def f():</div><div class="cm-line">    return 1</div></div></pre>';
  assert.equal(md(html), '```python\ndef f():\n    return 1\n```');
});

test('code block without <code>: the copy button is dropped (known limit: a bare language label is kept)', () => {
  const html = '<pre><div>python</div><button>Copier le code</button><div>print("ok")</div></pre>';
  assert.equal(md(html), '```\npythonprint("ok")\n```');
});

// ---- Real ChatGPT "turn-key" markup (from a user diagnostic, Nov. 2026) ----

const CHATGPT_OPTIONS = {
  ignore: ['[data-markdown-copy="exclude"]'],
  codeBlocks: ['[data-code-block="true"]'],
  codeLanguageLabels: ['[data-markdown-copy="exclude"] .truncate'],
};

/** Like React output: no formatting whitespace between tags. */
const codeBlock = (body) =>
  `
  <div data-chatgpt-copy-code="x"><div data-code-block="true" data-markdown-copy="code-block">
    <div data-markdown-copy="exclude" contenteditable="false"><svg></svg><div class="min-w-0 truncate flex-1">JavaScript</div>
      <div><div data-code-block-controls="true" role="presentation"><button>Copier</button></div></div></div>
    <div class="relative"><div class="w-full overflow-x-hidden"><div class="relative z-0 flex max-w-full">@BODY@</div></div>
      <button aria-hidden="true" aria-label="Faire défiler jusqu’en bas"></button></div>
  </div></div>`
    .replace(/>\s+</g, '><')
    .trim()
    .replace('@BODY@', body);
const EXPECTED_CODE = '```javascript\nfunction saluer(nom) {\n  return nom;\n}\n```';

test('turn-key code block with <pre><code>', () => {
  const html = codeBlock('<pre><code>function saluer(nom) {\n  return nom;\n}</code></pre>');
  assert.equal(md(html, CHATGPT_OPTIONS), EXPECTED_CODE);
});

test('turn-key code block with CodeMirror lines and a line-number gutter', () => {
  const html = codeBlock(
    '<div class="cm-gutters" aria-hidden="true"><div>1</div><div>2</div><div>3</div></div>' +
      '<div class="cm-content"><div class="cm-line">function saluer(nom) {</div><div class="cm-line">  return nom;</div><div class="cm-line">}</div></div>',
  );
  assert.equal(md(html, CHATGPT_OPTIONS), EXPECTED_CODE);
});

test('turn-key code block with bare text keeps indentation and newlines', () => {
  const html = codeBlock('<div>function saluer(nom) {\n  return nom;\n}</div>');
  assert.equal(md(html, CHATGPT_OPTIONS), EXPECTED_CODE);
});

test('turn-key display math span, table actions excluded', () => {
  const html =
    '<p><span>Pythagore :</span></p>' +
    '<span data-math-display="true" data-math-source="a^2 + b^2 = c^2"><span class="katex-display"><span class="katex">rendu</span></span></span>' +
    '<div data-markdown-table="true"><div><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table></div>' +
    '<div data-block-actions="true" data-markdown-copy="exclude"><button aria-label="Copier le tableau"></button></div></div>';
  assert.equal(md(html, CHATGPT_OPTIONS), 'Pythagore :\n\n$$\na^2 + b^2 = c^2\n$$\n\n| A |\n| --- |\n| 1 |');
});
