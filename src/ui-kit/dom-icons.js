/**
 * @file Replaces every `<el data-icon="name">` with the matching inline SVG.
 * Keeps HTML templates readable: <span data-icon="send"></span>.
 */

import { icon } from './icons.js';

/**
 * @param {ParentNode} [root=document]
 */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    const size = Number(el.dataset.iconSize) || undefined;
    el.innerHTML = icon(el.dataset.icon, { size });
  }
}
