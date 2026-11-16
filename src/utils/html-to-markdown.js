/**
 * @file Rendered chat HTML → clean Markdown.
 *
 * Why not read `innerText`? It loses everything that matters to the next
 * AI: code fences and their language, list nesting, headings, tables,
 * links and math. The rendered HTML is the most faithful source available
 * without any API.
 *
 * Supported: headings, paragraphs, line breaks, bold/italic/strike, inline
 * code, fenced code blocks (with language, robust to ChatGPT's code header),
 * ordered/unordered/nested lists, blockquotes, tables, links, images, rules,
 * KaTeX math (inline $…$ and display $$…$$).
 *
 * Pure DOM walking (no innerText, no layout): works in content scripts and
 * in unit tests with a lightweight DOM.
 */

const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DETAILS', 'DIV', 'DL', 'FIELDSET',
  'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY',
  'TABLE', 'UL',
]);

/** Never part of the content. */
const ALWAYS_IGNORED = ['script', 'style', 'noscript', 'template', 'button', 'svg', '.sr-only'];

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/**
 * @param {Element} root
 * @param {{ignore?: string[]}} [options]  Extra CSS selectors to skip (site UI).
 * @returns {string}
 */
export function htmlToMarkdown(root, { ignore = [] } = {}) {
  const ctx = { ignore: [...ALWAYS_IGNORED, ...ignore].join(',') };
  return joinBlocks(renderBlocks(root, ctx)).trim();
}

// ---- Block level -----------------------------------------------------------

/**
 * Renders the children of `node` as a list of Markdown blocks.
 * Consecutive inline content is grouped into one paragraph.
 */
function renderBlocks(node, ctx) {
  const blocks = [];
  let inline = '';
  const flush = () => {
    const paragraph = tidyParagraph(inline);
    if (paragraph) blocks.push(paragraph);
    inline = '';
  };

  for (const child of node.childNodes) {
    if (isIgnored(child, ctx)) continue;
    if (isBlock(child)) {
      flush();
      blocks.push(...renderBlock(child, ctx));
    } else {
      inline += renderInline(child, ctx);
    }
  }
  flush();
  return blocks.filter(Boolean);
}

/** @returns {string[]} */
function renderBlock(el, ctx) {
  const tag = el.tagName;
  if (/^H[1-6]$/.test(tag)) return heading(el, ctx);
  switch (tag) {
    case 'PRE':
      return [codeBlock(el)];
    case 'UL':
    case 'OL':
      return [list(el, ctx)];
    case 'BLOCKQUOTE':
      return [blockquote(el, ctx)];
    case 'TABLE':
      return [table(el, ctx)];
    case 'HR':
      return ['---'];
    default:
      if (isDisplayMath(el)) return [`$$\n${tex(el)}\n$$`];
      return renderBlocks(el, ctx); // transparent container (div, p, section…)
  }
}

function heading(el, ctx) {
  const text = tidyParagraph(renderInlineChildren(el, ctx)).replace(/\n+/g, ' ');
  return text ? [`${'#'.repeat(Number(el.tagName[1]))} ${text}`] : [];
}

function codeBlock(pre) {
  const code = pre.querySelector('code');
  const source = (code ?? pre).textContent.replace(/\n$/, '');
  const language = detectLanguage(code);
  const fence = fenceFor(source, '`', 3);
  return `${fence}${language}\n${source}\n${fence}`;
}

function detectLanguage(code) {
  const match = code?.className?.match?.(/(?:^|\s)(?:language|lang)-([\w#+.-]+)/);
  return match ? match[1] : '';
}

function list(el, ctx, depth = 0) {
  const ordered = el.tagName === 'OL';
  let index = Number(el.getAttribute('start')) || 1;
  const items = [];

  for (const li of el.children) {
    if (li.tagName !== 'LI') continue;
    const marker = ordered ? `${index++}. ` : '- ';
    const body = renderBlocks(li, ctx).join('\n');
    items.push(marker + indent(body, ' '.repeat(marker.length)).trimStart());
  }
  return items.join('\n');
}

function blockquote(el, ctx) {
  return joinBlocks(renderBlocks(el, ctx))
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');
}

function table(el, ctx) {
  const rows = [...el.querySelectorAll('tr')].map((tr) =>
    [...tr.children]
      .filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD')
      .map((cell) => tableCell(cell, ctx)),
  );
  if (!rows.length) return '';

  const width = Math.max(...rows.map((r) => r.length));
  const line = (cells) => `| ${pad(cells, width).join(' | ')} |`;
  const separator = `| ${Array(width).fill('---').join(' | ')} |`;
  const [header, ...body] = rows;
  return [line(header), separator, ...body.map(line)].join('\n');
}

function tableCell(cell, ctx) {
  return tidyParagraph(renderBlocks(cell, ctx).join(' '))
    .replace(/\n+/g, ' ')
    .replace(/\|/g, '\\|');
}

// ---- Inline level ----------------------------------------------------------

function renderInlineChildren(el, ctx) {
  let out = '';
  for (const child of el.childNodes) {
    if (!isIgnored(child, ctx)) out += renderInline(child, ctx);
  }
  return out;
}

function renderInline(node, ctx) {
  if (node.nodeType === TEXT_NODE) return node.textContent.replace(/\s+/g, ' ');
  if (node.nodeType !== ELEMENT_NODE) return '';
  if (isMath(node)) return `$${tex(node)}$`;

  switch (node.tagName) {
    case 'BR':
      return '\n';
    case 'STRONG':
    case 'B':
      return wrap(renderInlineChildren(node, ctx), '**');
    case 'EM':
    case 'I':
      return wrap(renderInlineChildren(node, ctx), '*');
    case 'DEL':
    case 'S':
      return wrap(renderInlineChildren(node, ctx), '~~');
    case 'CODE':
      return inlineCode(node.textContent);
    case 'A':
      return link(node, ctx);
    case 'IMG':
      return image(node);
    default:
      // Block elements nested in inline context (rare) degrade to text.
      return isBlock(node)
        ? ` ${joinBlocks(renderBlocks(node, ctx))} `
        : renderInlineChildren(node, ctx);
  }
}

/** Wraps the trimmed content, keeping surrounding spaces outside the markers. */
function wrap(content, marker) {
  const core = content.trim();
  if (!core) return content;
  const lead = content.match(/^\s*/)[0];
  const trail = content.match(/\s*$/)[0];
  return `${lead}${marker}${core}${marker}${trail}`;
}

function inlineCode(text) {
  const fence = fenceFor(text, '`', 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

function link(a, ctx) {
  const text = renderInlineChildren(a, ctx).trim();
  const href = a.getAttribute('href') ?? '';
  if (!/^(https?:|mailto:)/i.test(href)) return text;
  if (!text || text === href) return `<${href}>`;
  return `[${text}](${href})`;
}

function image(img) {
  const src = img.getAttribute('src') ?? '';
  if (!/^https?:/i.test(src)) return '';
  return `![${img.getAttribute('alt') ?? ''}](${src})`;
}

// ---- Math (KaTeX) ----------------------------------------------------------

function isMath(el) {
  return el.classList?.contains('katex');
}

function isDisplayMath(el) {
  return el.classList?.contains('katex-display');
}

function tex(el) {
  const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
  return (annotation?.textContent ?? el.textContent).trim();
}

// ---- Helpers ---------------------------------------------------------------

function isBlock(node) {
  return node.nodeType === ELEMENT_NODE && (BLOCK_TAGS.has(node.tagName) || isDisplayMath(node));
}

function isIgnored(node, ctx) {
  return node.nodeType === ELEMENT_NODE && !isMath(node) && node.matches(ctx.ignore);
}

/** A fence longer than any run of `char` inside `text`. */
function fenceFor(text, char, min) {
  const longest = Math.max(0, ...(text.match(new RegExp(`\\${char}+`, 'g')) ?? []).map((r) => r.length));
  return char.repeat(Math.max(min, longest + 1));
}

function tidyParagraph(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}

function joinBlocks(blocks) {
  return blocks.filter(Boolean).join('\n\n');
}

function indent(text, prefix) {
  return text
    .split('\n')
    .map((line) => (line ? prefix + line : line))
    .join('\n');
}

function pad(cells, width) {
  return [...cells, ...Array(width - cells.length).fill('')];
}
