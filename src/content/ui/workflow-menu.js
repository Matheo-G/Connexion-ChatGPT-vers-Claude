/**
 * @file Send options opened from the send button's chevron: destination AI
 * ("Envoyer vers") and workflow. Choosing an item sends right away.
 *
 * Rendered in its own top-level Shadow DOM host (position: fixed, attached
 * to <body>), NOT inside the page's action bar: ChatGPT's containers may
 * clip overflow or be transformed by the virtualised thread, which would
 * cut or misplace a nested menu.
 *
 * Keyboard: ↑/↓ to move, Enter to choose, Escape to close. Closes on an
 * outside click; follows its button when the page scrolls or resizes
 * (ChatGPT scrolls by itself while rendering), and closes only if the
 * button disappears.
 */

import { icon } from '../../ui-kit/icons.js';
import { createShadowHost, destroyShadowHost } from './shadow.js';

export const MENU_MARKER = 'data-ai-router-menu';
const GAP = 6;

const CSS = `
:host { all: initial; position: fixed; z-index: 2147483647; font-family: var(--font-sans); }
.menu { min-width: 230px; padding: 4px; border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-bg); color: var(--color-text); box-shadow: var(--shadow-md);
  animation: pop var(--duration-base) var(--ease-out); }
.title { padding: 8px 10px 4px; font: 600 11px/1.2 var(--font-sans); color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: .05em; }
button { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer; font: 500 13px/1.3 var(--font-sans); }
button:hover, button:focus-visible { background: var(--color-surface-hover); }
button[aria-current="true"] { color: var(--color-accent); }
svg { flex: none; color: var(--color-text-muted); }
button[aria-current="true"] svg { color: var(--color-accent); }
[role="group"] + [role="group"] { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--color-border); }
kbd { margin-inline-start: auto; font: 500 11px/1 var(--font-mono); color: var(--color-text-muted); }
@keyframes pop { from { opacity: 0; transform: translateY(4px) scale(.98); } to { opacity: 1; transform: none; } }
`;

/**
 * @typedef {Object} MenuItem
 * @property {string} id
 * @property {string} label
 * @property {string} icon
 * @property {string | null} [hint]     Shown on the right (e.g. "/figma").
 * @property {boolean} [current]        Highlighted: what a plain click would use.
 *
 * @typedef {Object} MenuSection
 * @property {string} key               Sent back with the choice ("workflowId", "targetProviderId").
 * @property {string} title
 * @property {MenuItem[]} items
 */

/**
 * @param {Object} options
 * @param {HTMLElement} options.anchor  Element the menu is attached to (positioning).
 * @param {string} options.label        Accessible name of the whole menu.
 * @param {MenuSection[]} options.sections
 * @param {(choice: Record<string, string>) => void} options.onChoose  e.g. {workflowId: 'code'}
 * @param {() => void} [options.onClose]
 * @returns {{close: () => void}}
 */
export function openWorkflowMenu({ anchor, label, sections, onChoose, onClose }) {
  const { host, root } = createShadowHost({ tag: 'div', marker: MENU_MARKER, css: CSS });
  root.innerHTML = '<div class="menu" role="menu"></div>';
  const menu = root.querySelector('.menu');
  menu.setAttribute('aria-label', label);

  const items = [];
  for (const section of sections.filter((s) => s.items.length > 1)) {
    const group = document.createElement('div');
    group.setAttribute('role', 'group');
    group.dataset.section = section.key;
    const title = document.createElement('div');
    title.className = 'title';
    title.id = `menu-${section.key}`;
    title.textContent = section.title;
    group.setAttribute('aria-labelledby', title.id);
    group.append(title);

    for (const entry of section.items) {
      const item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      item.dataset[section.key === 'workflowId' ? 'workflow' : 'target'] = entry.id;
      if (entry.current) item.setAttribute('aria-current', 'true');
      item.innerHTML = `${icon(entry.icon, { size: 15 })}<span></span>${entry.hint ? '<kbd></kbd>' : ''}`;
      item.querySelector('span').textContent = entry.label;
      if (entry.hint) item.querySelector('kbd').textContent = entry.hint;
      item.addEventListener('click', () => {
        close();
        onChoose({ [section.key]: entry.id });
      });
      group.append(item);
      items.push(item);
    }
    menu.append(group);
  }

  document.body.append(host);
  place(host, anchor);

  const onKey = (event) => {
    const index = items.indexOf(root.activeElement);
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowDown') items[(index + 1) % items.length].focus();
    else if (event.key === 'ArrowUp') items[(index - 1 + items.length) % items.length].focus();
    else return;
    event.preventDefault();
  };
  const onOutside = (event) => {
    if (!event.composedPath().some((node) => node === host || node === anchor)) close();
  };
  const onViewportChange = () => (anchor.isConnected ? place(host, anchor) : close());

  root.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);
  (items.find((i) => i.getAttribute('aria-current')) ?? items[0])?.focus();

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange);
    destroyShadowHost(host);
    onClose?.();
  }
  return { close };
}

/** Above the anchor, right-aligned; below it when there is no room above. */
function place(host, anchor) {
  const rect = anchor.getBoundingClientRect();
  const { offsetWidth: width, offsetHeight: height } = host;
  const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
  const above = rect.top - height - GAP;
  const top = above >= 8 ? above : Math.min(rect.bottom + GAP, window.innerHeight - height - 8);
  Object.assign(host.style, { left: `${left}px`, top: `${top}px` });
}
