/**
 * @file Workflow picker opened from the send button's chevron.
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
.title { padding: 6px 10px 4px; font: 600 11px/1.2 var(--font-sans); color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: .05em; }
button { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer; font: 500 13px/1.3 var(--font-sans); }
button:hover, button:focus-visible { background: var(--color-surface-hover); }
button[aria-current="true"] { color: var(--color-accent); }
svg { flex: none; color: var(--color-text-muted); }
button[aria-current="true"] svg { color: var(--color-accent); }
kbd { margin-inline-start: auto; font: 500 11px/1 var(--font-mono); color: var(--color-text-muted); }
@keyframes pop { from { opacity: 0; transform: translateY(4px) scale(.98); } to { opacity: 1; transform: none; } }
`;

/**
 * @param {Object} options
 * @param {HTMLElement} options.anchor  Element the menu is attached to (positioning).
 * @param {string} options.title
 * @param {{id: string, label: string, icon: string, command: string | null}[]} options.workflows
 * @param {string | null} [options.currentId]  Highlighted (detected) workflow.
 * @param {(workflowId: string) => void} options.onChoose
 * @param {() => void} [options.onClose]
 * @returns {{close: () => void}}
 */
export function openWorkflowMenu({ anchor, title, workflows, currentId = null, onChoose, onClose }) {
  const { host, root } = createShadowHost({ tag: 'div', marker: MENU_MARKER, css: CSS });
  root.innerHTML = '<div class="menu" role="menu"><div class="title"></div></div>';
  const menu = root.querySelector('.menu');
  menu.querySelector('.title').textContent = title;
  menu.setAttribute('aria-label', title);

  const items = workflows.map((workflow) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.dataset.workflow = workflow.id;
    if (workflow.id === currentId) item.setAttribute('aria-current', 'true');
    item.innerHTML = `${icon(workflow.icon, { size: 15 })}<span></span>${workflow.command ? '<kbd></kbd>' : ''}`;
    item.querySelector('span').textContent = workflow.label;
    if (workflow.command) item.querySelector('kbd').textContent = workflow.command;
    item.addEventListener('click', () => {
      close();
      onChoose(workflow.id);
    });
    menu.append(item);
    return item;
  });

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
