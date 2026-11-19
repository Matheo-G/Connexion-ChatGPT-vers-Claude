/**
 * @file Shadow DOM hosts for UI injected into third-party pages.
 *
 * Why Shadow DOM: the host page's CSS cannot restyle our UI, and ours cannot
 * leak into the page. Our design tokens (ui-kit/tokens.css) are loaded once,
 * rewritten from `:root` to `:host`, and shared by every injected component.
 *
 * Theme: follows the PAGE (ChatGPT toggles `dark` / `light` on <html>), not
 * only the OS, so the button always matches its surroundings.
 */

const TOKENS_PATH = 'src/ui-kit/tokens.css';

/** Constructable sheet with the tokens, shared by all hosts. */
let tokensSheet = null;
const hosts = new Set();
let themeObserver = null;

/** `:root` selectors → `:host` selectors, so tokens apply inside a shadow root. */
function toHostSelectors(css) {
  return css
    .replaceAll(":root[data-theme='dark']", ":host([data-theme='dark'])")
    .replaceAll(":root:not([data-theme='light'])", ":host(:not([data-theme='light']))")
    .replaceAll(':root', ':host');
}

/** Must be awaited once before creating hosts (fetches the tokens). */
export async function loadUiStyles() {
  if (tokensSheet) return;
  const css = await (await fetch(chrome.runtime.getURL(TOKENS_PATH))).text();
  tokensSheet = new CSSStyleSheet();
  tokensSheet.replaceSync(toHostSelectors(css));
}

/**
 * @param {{tag?: string, marker: string, css: string}} options
 *   marker: attribute set on the host, used to find/dedupe our elements.
 * @returns {{host: HTMLElement, root: ShadowRoot}}
 */
export function createShadowHost({ tag = 'span', marker, css }) {
  const host = document.createElement(tag);
  host.setAttribute(marker, '');
  const root = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  root.adoptedStyleSheets = tokensSheet ? [tokensSheet, sheet] : [sheet];

  hosts.add(host);
  applyPageTheme(host);
  watchPageTheme();
  return { host, root };
}

/** Removes a host and stops tracking it. */
export function destroyShadowHost(host) {
  hosts.delete(host);
  host.remove();
}

/**
 * 'dark' | 'light' | null. The page's declared theme (ChatGPT sets a class on
 * <html>); otherwise inferred from the actual page background, so the button
 * never uses dark colours on a light page because the OS is in dark mode.
 */
function pageTheme() {
  const { classList } = document.documentElement;
  if (classList.contains('dark')) return 'dark';
  if (classList.contains('light')) return 'light';
  return themeFromBackground();
}

function themeFromBackground() {
  for (const el of [document.body, document.documentElement]) {
    const match = el && getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
    if (!match) continue;
    const [r, g, b, alpha = 1] = match.map(Number);
    if (alpha === 0) continue; // transparent: look further up
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 ? 'dark' : 'light';
  }
  return 'light'; // browsers paint a white canvas by default
}

function applyPageTheme(host) {
  const theme = pageTheme();
  if (theme) host.dataset.theme = theme;
  else delete host.dataset.theme;
}

function watchPageTheme() {
  if (themeObserver) return;
  themeObserver = new MutationObserver(() => hosts.forEach(applyPageTheme));
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

/** Stops theme tracking and forgets every host (runtime teardown). */
export function disposeShadowHosts() {
  themeObserver?.disconnect();
  themeObserver = null;
  hosts.forEach((host) => host.remove());
  hosts.clear();
}
