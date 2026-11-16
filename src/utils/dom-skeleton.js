/**
 * @file Anonymous DOM skeleton, for troubleshooting a site's new layout.
 *
 * Keeps the STRUCTURE (tags, classes, data-* / role / aria attributes) and
 * drops every piece of CONTENT: text is replaced by its length, so the
 * output can be shared without revealing the conversation.
 *
 *   <div [data-turn-key="…"] .group>
 *     <div [data-user-message-bubble="true"]> txt:42
 */

const SKIPPED_CHILDREN = new Set(['SVG', 'svg', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'PATH']);
const KEPT_ATTRIBUTES = /^(data-|aria-label$|aria-hidden$|role$|type$|contenteditable$|hidden$)/;
const MAX_VALUE = 48;
/** Values that look like technical identifiers/flags; anything else may be content. */
const TECHNICAL_VALUE = /^[\w:./#-]{0,64}$/;
/** UI labels (buttons…) are useful and never conversation content. */
const LABEL_ATTRIBUTES = new Set(['aria-label', 'role', 'type']);
const MAX_SAME_TAG = 6;

/**
 * @param {Element} root
 * @param {{maxDepth?: number, maxNodes?: number, isRendered?: (el: Element) => boolean}} [options]
 * @returns {string}
 */
export function domSkeleton(root, { maxDepth = 14, maxNodes = 500, isRendered = () => true } = {}) {
  const lines = [];
  const budget = { nodes: maxNodes };
  walk(root, 0, { lines, budget, maxDepth, isRendered });
  if (budget.nodes <= 0) lines.push('… (truncated)');
  return lines.join('\n');
}

function walk(el, depth, ctx) {
  if (ctx.budget.nodes-- <= 0) return;
  const pad = '  '.repeat(depth);
  const text = ownTextLength(el);
  const hidden = ctx.isRendered(el) ? '' : ' (hidden)';
  ctx.lines.push(`${pad}${describe(el)}${hidden}${text ? ` txt:${text}` : ''}`);

  if (depth >= ctx.maxDepth || SKIPPED_CHILDREN.has(el.tagName)) return;
  const counts = new Map();
  for (const child of el.children) {
    const seen = (counts.get(child.tagName) ?? 0) + 1;
    counts.set(child.tagName, seen);
    if (seen <= MAX_SAME_TAG) walk(child, depth + 1, ctx);
  }
  for (const [tag, count] of counts) {
    if (count > MAX_SAME_TAG) ctx.lines.push(`${pad}  … +${count - MAX_SAME_TAG} <${tag.toLowerCase()}>`);
  }
}

function describe(el) {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const classes = [...el.classList].slice(0, 4).map((c) => `.${c}`).join('');
  const attributes = [...el.attributes]
    .filter((a) => KEPT_ATTRIBUTES.test(a.name))
    .map((a) => `[${a.name}="${safeValue(a)}"]`)
    .join('');
  return `<${tag}${id}${attributes}${classes ? ` ${classes}` : ''}>`;
}

/** Length of the text directly inside the element (not its children). */
function ownTextLength(el) {
  let length = 0;
  for (const node of el.childNodes) {
    if (node.nodeType === 3) length += node.textContent.trim().length;
  }
  return length;
}

/** Masks attribute values that could carry content (e.g. a formula). */
function safeValue(attribute) {
  if (LABEL_ATTRIBUTES.has(attribute.name)) return shorten(attribute.value);
  return TECHNICAL_VALUE.test(attribute.value) ? shorten(attribute.value) : '…';
}

function shorten(value) {
  const clean = value.replace(/\s+/g, ' ');
  return clean.length > MAX_VALUE ? `${clean.slice(0, MAX_VALUE)}…` : clean;
}
