/**
 * @file Async helpers: sleep, timeout, polling, retry.
 * Every helper rejects with a RouterError so callers handle one error shape.
 */

import { RouterError, ErrorCode } from '../shared/errors.js';

/** @param {number} ms */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Rejects if `promise` does not settle within `ms`.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {{code?: string, message?: string}} [options]
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, { code = ErrorCode.TIMEOUT, message } = {}) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new RouterError(code, message || `Timed out after ${ms} ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Calls `fn` every `interval` ms until it returns a truthy value.
 * Errors thrown by `fn` count as "not yet" (useful while a page is loading).
 * @template T
 * @param {() => Promise<T> | T} fn
 * @param {{interval?: number, timeout: number, code?: string, message?: string}} options
 * @returns {Promise<T>}
 */
export async function poll(fn, { interval = 250, timeout, code = ErrorCode.TIMEOUT, message }) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await Promise.resolve()
      .then(fn)
      .catch(() => undefined);
    if (value) return value;
    await sleep(interval);
  }
  throw new RouterError(code, message || `Condition not met within ${timeout} ms`);
}

/**
 * Retries `fn` with exponential backoff.
 * @template T
 * @param {(attempt: number) => Promise<T>} fn
 * @param {{attempts?: number, delay?: number, factor?: number,
 *          shouldRetry?: (error: RouterError) => boolean,
 *          onRetry?: (error: RouterError, attempt: number) => void}} [options]
 * @returns {Promise<T>}
 */
export async function retry(fn, options = {}) {
  const { attempts = 3, delay = 200, factor = 2, shouldRetry = () => true, onRetry } = options;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = RouterError.from(error);
      if (attempt === attempts || !shouldRetry(lastError)) break;
      onRetry?.(lastError, attempt);
      await sleep(delay * factor ** (attempt - 1));
    }
  }
  throw lastError;
}
