/**
 * @file "🚀 Claude" split button injected under each AI answer.
 *
 *   [ ➤ Claude | ▾ ]   main part: send with the default workflow
 *                       chevron: pick another workflow (hidden while only one exists)
 *
 * States (host[data-state]): idle → busy (spinner + step) → success | error → idle.
 */

import { icon } from '../../ui-kit/icons.js';
import { createShadowHost, destroyShadowHost } from './shadow.js';

export const BUTTON_MARKER = 'data-ai-router-button';
const RESET_DELAY = { success: 6_000, error: 5_000 };

const CSS = `
:host { all: initial; display: inline-flex; align-items: center; margin-inline-start: 4px;
  font-family: var(--font-sans); position: relative; vertical-align: middle; }
.split { display: inline-flex; align-items: stretch; height: 28px; border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--color-accent) 40%, transparent);
  background: color-mix(in srgb, var(--color-accent) 10%, transparent); color: var(--color-accent);
  transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out); }
.split:hover { background: color-mix(in srgb, var(--color-accent) 18%, transparent); }
button { all: unset; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; color: inherit;
  font: 600 12.5px/1 var(--font-sans); letter-spacing: -0.005em; }
button:focus-visible { box-shadow: var(--focus-ring); border-radius: var(--radius-full); }
.main { padding: 0 11px 0 9px; }
.more { padding: 0 8px 0 6px; border-inline-start: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent); }
.more[hidden] { display: none; }
.icon { display: grid; place-items: center; width: 14px; height: 14px; }
.spinner { width: 12px; height: 12px; border-radius: 50%; border: 2px solid currentColor;
  border-right-color: transparent; animation: spin .8s linear infinite; }
:host([data-state="busy"]) .split { cursor: progress; }
:host([data-state="busy"]) button { cursor: progress; }
:host([data-state="success"]) .split { color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
  background: color-mix(in srgb, var(--color-success) 12%, transparent); }
:host([data-state="error"]) .split { color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
  background: color-mix(in srgb, var(--color-danger) 12%, transparent); }
.label { animation: fade var(--duration-base) var(--ease-out); }
.menu { position: absolute; bottom: calc(100% + 6px); inset-inline-end: 0; min-width: 210px; padding: 4px;
  border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg);
  box-shadow: var(--shadow-md); z-index: 2147483647; animation: pop var(--duration-base) var(--ease-out); }
.menu[hidden] { display: none; }
.menu-title { padding: 6px 10px 4px; font: 600 11px/1.2 var(--font-sans); color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: .05em; }
.item { display: flex; width: 100%; box-sizing: border-box; gap: 8px; padding: 8px 10px; border-radius: var(--radius-sm);
  color: var(--color-text); font-weight: 500; }
.item:hover, .item:focus-visible { background: var(--color-surface-hover); }
.item kbd { margin-inline-start: auto; font: 500 11px/1 var(--font-mono); color: var(--color-text-muted); }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pop { from { opacity: 0; transform: translateY(4px) scale(.98); } to { opacity: 1; transform: none; } }
`;

const STATE_ICON = { idle: 'send', success: 'check', error: 'alert' };

/**
 * @param {Object} options
 * @param {string} options.label       Idle label (target name, e.g. "Claude").
 * @param {string} options.title       Tooltip / accessible name.
 * @param {string} options.menuTitle
 * @param {{id: string, label: string, icon: string, command: string | null}[]} options.workflows
 * @param {(workflowId?: string) => void} options.onSend
 */
export function createSendButton({ label, title, menuTitle, workflows, onSend }) {
  const { host, root } = createShadowHost({ marker: BUTTON_MARKER, css: CSS });
  root.innerHTML = `
    <div class="split">
      <button class="main" type="button"><span class="icon"></span><span class="label"></span></button>
      <button class="more" type="button" aria-haspopup="menu" aria-expanded="false">${icon('chevronDown', { size: 12 })}</button>
    </div>
    <div class="menu" role="menu" hidden></div>`;

  const main = root.querySelector('.main');
  const more = root.querySelector('.more');
  const menu = root.querySelector('.menu');
  main.title = title;
  main.setAttribute('aria-label', title);
  more.setAttribute('aria-label', menuTitle);
  more.hidden = workflows.length < 2;

  let resetTimer = null;

  /** @param {'idle'|'busy'|'success'|'error'} state @param {string} [text] */
  function setState(state, text = label) {
    clearTimeout(resetTimer);
    host.dataset.state = state;
    main.setAttribute('aria-busy', String(state === 'busy'));
    root.querySelector('.icon').innerHTML =
      state === 'busy' ? '<span class="spinner"></span>' : icon(STATE_ICON[state], { size: 14 });
    const labelEl = root.querySelector('.label');
    labelEl.textContent = text;
    labelEl.replaceWith(labelEl.cloneNode(true)); // restart the fade animation
    if (RESET_DELAY[state]) resetTimer = setTimeout(() => setState('idle'), RESET_DELAY[state]);
  }

  function renderMenu() {
    menu.innerHTML = `<div class="menu-title"></div>`;
    menu.firstChild.textContent = menuTitle;
    for (const workflow of workflows) {
      const item = document.createElement('button');
      item.className = 'item';
      item.setAttribute('role', 'menuitem');
      item.innerHTML = `${icon(workflow.icon, { size: 14 })}<span></span>${workflow.command ? '<kbd></kbd>' : ''}`;
      item.querySelector('span').textContent = workflow.label;
      if (workflow.command) item.querySelector('kbd').textContent = workflow.command;
      item.addEventListener('click', () => {
        toggleMenu(false);
        trigger(workflow.id);
      });
      menu.append(item);
    }
  }

  function toggleMenu(open = menu.hidden) {
    menu.hidden = !open;
    more.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('.item')?.focus();
  }

  function trigger(workflowId) {
    if (host.dataset.state === 'busy') return; // no double send
    onSend(workflowId);
  }

  const closeOnOutside = (event) => !event.composedPath().includes(host) && toggleMenu(false);
  const closeOnEscape = (event) => event.key === 'Escape' && toggleMenu(false);

  main.addEventListener('click', (event) => {
    event.stopPropagation(); // never let the page treat it as its own action
    trigger();
  });
  more.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMenu();
  });
  document.addEventListener('click', closeOnOutside, true);
  root.addEventListener('keydown', closeOnEscape);

  renderMenu();
  setState('idle');

  return {
    host,
    setState,
    destroy() {
      clearTimeout(resetTimer);
      document.removeEventListener('click', closeOnOutside, true);
      destroyShadowHost(host);
    },
  };
}
