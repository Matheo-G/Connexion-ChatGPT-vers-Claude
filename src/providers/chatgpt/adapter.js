/**
 * @file ChatGPT DOM adapter (runs inside chatgpt.com).
 *
 * Step 1: only describes the page for the handshake.
 * Step 3 adds SOURCE_EXTRACT; step 4 mounts the "Send to Claude" button.
 */

/**
 * @param {{log: ReturnType<import('../../utils/logger.js').createLogger>}} context
 * @returns {import('../../content/runtime.js').ProviderAdapter}
 */
export function createAdapter({ log }) {
  log.debug('ChatGPT adapter created');
  return {
    describe: () => ({ path: location.pathname }),
    handlers: {},
    destroy() {},
  };
}
