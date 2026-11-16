/**
 * @file Toast notifications shown inside the AI page (bottom-right, above the composer).
 *
 *   showToast({ tone: 'error', message: '…', action: { label: 'Réessayer', run } })
 *
 * One shared host; at most 3 toasts; auto-dismiss (errors stay longer);
 * announced to screen readers (role="status" / "alert").
 */

import { icon } from '../../ui-kit/icons.js';
import { createShadowHost, destroyShadowHost } from './shadow.js';

export const TOAST_MARKER = 'data-ai-router-toasts';
const MAX_TOASTS = 3;
const DURATION = { info: 4_000, success: 4_000, error: 8_000 };
const ICON = { info: 'sparkles', success: 'check', error: 'alert' };

const CSS = `
:host { all: initial; position: fixed; right: 24px; bottom: 112px; z-index: 2147483647;
  display: flex; flex-direction: column; align-items: flex-end; gap: 8px; font-family: var(--font-sans);
  pointer-events: none; }
.toast { pointer-events: auto; display: flex; align-items: flex-start; gap: 10px; max-width: 360px;
  padding: 12px 12px 12px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-lg);
  background: var(--color-bg); color: var(--color-text); box-shadow: var(--shadow-md);
  font: 500 13.5px/1.45 var(--font-sans); animation: enter var(--duration-slow) var(--ease-out); }
.toast.leaving { animation: leave var(--duration-base) var(--ease-out) forwards; }
.glyph { flex: none; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; margin-top: -1px; }
.toast[data-tone="success"] .glyph { color: var(--color-success); background: color-mix(in srgb, var(--color-success) 14%, transparent); }
.toast[data-tone="error"] .glyph { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 14%, transparent); }
.toast[data-tone="info"] .glyph { color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 14%, transparent); }
.body { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.brand { font: 600 11px/1 var(--font-sans); letter-spacing: .04em; text-transform: uppercase; color: var(--color-text-muted); }
button { all: unset; cursor: pointer; font: 600 12.5px/1 var(--font-sans); }
button:focus-visible { box-shadow: var(--focus-ring); border-radius: var(--radius-sm); }
.action { align-self: flex-start; padding: 7px 12px; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-contrast); }
.action:hover { background: var(--color-accent-hover); }
.close { flex: none; display: grid; place-items: center; width: 22px; height: 22px; border-radius: var(--radius-sm);
  color: var(--color-text-muted); }
.close:hover { background: var(--color-surface-hover); color: var(--color-text); }
@keyframes enter { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes leave { to { opacity: 0; transform: translateY(4px); } }
`;

let container = null;

function ensureContainer() {
  if (container?.host.isConnected) return container;
  container = createShadowHost({ tag: 'div', marker: TOAST_MARKER, css: CSS });
  document.body.append(container.host);
  return container;
}

/**
 * @param {Object} options
 * @param {'info'|'success'|'error'} [options.tone='info']
 * @param {string} options.message
 * @param {{label: string, run: () => void}} [options.action]
 * @param {string} [options.closeLabel='Fermer']
 * @returns {() => void} dismiss function
 */
export function showToast({ tone = 'info', message, action, closeLabel = 'Fermer' }) {
  const { root } = ensureContainer();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.dataset.tone = tone;
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  toast.innerHTML = `
    <span class="glyph">${icon(ICON[tone], { size: 14 })}</span>
    <div class="body"><span class="brand">Mathéo AI Router</span><span class="message"></span></div>
    <button class="close" type="button">${icon('close', { size: 14 })}</button>`;
  toast.querySelector('.message').textContent = message;
  toast.querySelector('.close').setAttribute('aria-label', closeLabel);

  if (action) {
    const button = document.createElement('button');
    button.className = 'action';
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      dismiss();
      action.run();
    });
    toast.querySelector('.body').append(button);
  }

  const dismiss = () => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 200);
  };
  toast.querySelector('.close').addEventListener('click', dismiss);
  setTimeout(dismiss, DURATION[tone]);

  root.append(toast);
  while (root.querySelectorAll('.toast:not(.leaving)').length > MAX_TOASTS) {
    root.querySelector('.toast:not(.leaving)').remove();
  }
  return dismiss;
}

/** Removes the toast host (runtime teardown). */
export function disposeToasts() {
  if (container) destroyShadowHost(container.host);
  container = null;
}
