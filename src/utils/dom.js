/**
 * @file DOM helpers for provider adapters (content-script side only).
 *
 * Selectors are always given as ordered lists: the first one that matches
 * wins. This is how adapters survive the frequent UI changes of AI sites —
 * a stable attribute first, then progressively more generic fallbacks.
 */

import { RouterError, ErrorCode } from '../shared/errors.js';
import { Timeouts } from '../shared/defaults.js';
import { sleep } from './async.js';

/**
 * @param {string[]} selectors  Ordered fallbacks.
 * @param {{root?: ParentNode, filter?: (el: Element) => boolean}} [options]
 * @returns {{element: Element, selector: string} | null}
 */
export function queryFirst(selectors, { root = document, filter = isVisible } = {}) {
  for (const selector of selectors) {
    const element = [...root.querySelectorAll(selector)].find(filter);
    if (element) return { element, selector };
  }
  return null;
}

/**
 * Waits until one of the selectors matches (MutationObserver, so it also
 * works in background tabs where timers are throttled).
 * @param {string[]} selectors
 * @param {{root?: ParentNode, timeout?: number, code?: string, filter?: (el: Element) => boolean}} [options]
 * @returns {Promise<{element: Element, selector: string}>}
 */
export function waitForElement(selectors, options = {}) {
  const { root = document, timeout = Timeouts.ELEMENT, code = ErrorCode.TIMEOUT, filter } = options;
  const found = queryFirst(selectors, { root, filter });
  if (found) return Promise.resolve(found);

  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const match = queryFirst(selectors, { root, filter });
      if (match) finish(() => resolve(match));
    });
    const timer = setTimeout(
      () => finish(() => reject(new RouterError(code, 'Element not found', { selectors }))),
      timeout,
    );
    const finish = (settle) => {
      observer.disconnect();
      clearTimeout(timer);
      settle();
    };
    observer.observe(root === document ? document.documentElement : root, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  });
}

/**
 * Polls a condition (cheap checks only). Resolves with its truthy value.
 * @template T
 * @param {() => T} check
 * @param {{timeout?: number, interval?: number}} [options]
 * @returns {Promise<T | null>} null on timeout (callers decide what it means).
 */
export async function waitForCondition(check, { timeout = 5_000, interval = 50 } = {}) {
  const deadline = Date.now() + timeout;
  do {
    const value = check();
    if (value) return value;
    await sleep(interval);
  } while (Date.now() < deadline);
  return null;
}

/** @param {Element} el */
export function isVisible(el) {
  if (!el?.isConnected) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/** @param {Element | null} button */
export function isEnabled(button) {
  return Boolean(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
}

/**
 * Focuses a contenteditable and puts the caret at its end.
 * @param {HTMLElement} editable
 */
export function focusAtEnd(editable) {
  editable.focus();
  const range = document.createRange();
  range.selectNodeContents(editable);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}
