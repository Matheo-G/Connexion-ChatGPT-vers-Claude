/**
 * @file Claude DOM adapter (runs inside claude.ai).
 *
 * Step 1: only describes the page for the handshake.
 * Step 2 adds TARGET_SUBMIT (insert + send) and TARGET_HEALTH.
 */

/**
 * @param {{log: ReturnType<import('../../utils/logger.js').createLogger>}} context
 * @returns {import('../../content/runtime.js').ProviderAdapter}
 */
export function createAdapter({ log }) {
  log.debug('Claude adapter created');
  return {
    describe: () => ({ path: location.pathname }),
    handlers: {},
    destroy() {},
  };
}
