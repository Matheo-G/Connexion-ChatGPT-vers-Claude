/**
 * @file "🚀 Claude" split button injected under each AI answer.
 *
 *   [ ➤ Claude /figma | ▾ ]   main part: send (badge = workflow detected from the prompt)
 *                             chevron: pick another workflow (see workflow-menu.js)
 *
 * States (host[data-state]): idle → busy (spinner + step) → success | error → idle.
 */

import { icon } from '../../ui-kit/icons.js';
import { createShadowHost, destroyShadowHost } from './shadow.js';
import { openWorkflowMenu } from './workflow-menu.js';

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
.badge { padding: 1px 6px; border-radius: var(--radius-full); font: 600 11px/1.2 var(--font-mono);
  background: var(--color-bg); border: 1px solid color-mix(in srgb, var(--color-accent) 35%, transparent); }
.badge[hidden] { display: none; }
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
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
`;

const STATE_ICON = { success: 'check', error: 'alert' };

/**
 * @param {Object} options
 * @param {string} options.label       Idle label (target name, e.g. "Claude").
 * @param {string} [options.icon='send']  Idle icon ("reply" for the way back to ChatGPT).
 * @param {string | null} [options.badge]  Workflow detected for this answer ("/figma"), shown when idle.
 * @param {string} options.title       Tooltip / accessible name.
 * @param {string} options.menuTitle
 * @param {import('./workflow-menu.js').MenuSection[]} options.sections  Destination / workflow choices.
 * @param {(choice?: Record<string, string>) => void} options.onSend
 *   Without choice: the defaults shown on the button; from the menu: {workflowId} or {targetProviderId}.
 */
export function createSendButton({ label, icon: idleIcon = 'send', badge = null, title, menuTitle, sections, onSend }) {
  const { host, root } = createShadowHost({ marker: BUTTON_MARKER, css: CSS });
  root.innerHTML = `
    <div class="split">
      <button class="main" type="button"><span class="icon"></span><span class="label"></span><span class="badge" hidden></span></button>
      <button class="more" type="button" aria-haspopup="menu" aria-expanded="false">${icon('chevronDown', { size: 12 })}</button>
    </div>`;

  const main = root.querySelector('.main');
  const more = root.querySelector('.more');
  let menu = null;
  main.title = title;
  // The accessible name starts with the visible text ("Claude /figma") so voice
  // control ("click Claude") works (WCAG 2.5.3), then adds the full description.
  main.setAttribute('aria-label', `${[label, badge].filter(Boolean).join(' ')} — ${title}`);
  if (menuTitle) more.setAttribute('aria-label', menuTitle);
  more.hidden = !sections.some((section) => section.items.length > 1);

  let resetTimer = null;

  /** @param {'idle'|'busy'|'success'|'error'} state @param {string} [text] */
  function setState(state, text = label) {
    clearTimeout(resetTimer);
    host.dataset.state = state;
    main.setAttribute('aria-busy', String(state === 'busy'));
    root.querySelector('.icon').innerHTML =
      state === 'busy' ? '<span class="spinner"></span>' : icon(state === 'idle' ? idleIcon : STATE_ICON[state], { size: 14 });
    const labelEl = root.querySelector('.label');
    labelEl.textContent = text;
    labelEl.replaceWith(labelEl.cloneNode(true)); // restart the fade animation
    const badgeEl = root.querySelector('.badge');
    badgeEl.textContent = badge ?? '';
    badgeEl.hidden = !badge || state !== 'idle';
    if (RESET_DELAY[state]) resetTimer = setTimeout(() => setState('idle'), RESET_DELAY[state]);
  }

  function toggleMenu() {
    if (menu) return menu.close();
    more.setAttribute('aria-expanded', 'true');
    menu = openWorkflowMenu({
      anchor: host,
      label: menuTitle,
      sections,
      onChoose: trigger,
      onClose: () => {
        menu = null;
        more.setAttribute('aria-expanded', 'false');
        more.focus();
      },
    });
  }

  function trigger(choice) {
    if (host.dataset.state === 'busy') return; // no double send
    onSend(choice);
  }

  main.addEventListener('click', (event) => {
    event.stopPropagation(); // never let the page treat it as its own action
    trigger();
  });
  more.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMenu();
  });
  setState('idle');

  return {
    host,
    setState,
    destroy() {
      clearTimeout(resetTimer);
      menu?.close();
      destroyShadowHost(host);
    },
  };
}
