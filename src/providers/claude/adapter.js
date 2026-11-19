/**
 * @file Claude DOM adapter (runs inside claude.ai).
 * Wires the writer to the message bus; DOM details live in writer.js / selectors.js.
 */

import { MessageType } from '../../shared/message-types.js';
import { submit, health } from './writer.js';
import { snapshot } from './diagnostics.js';

/**
 * @param {{log: ReturnType<import('../../utils/logger.js').createLogger>}} context
 * @returns {import('../../content/runtime.js').ProviderAdapter}
 */
export function createAdapter({ log }) {
  return {
    describe: () => ({ path: location.pathname, ...health() }),
    handlers: {
      [MessageType.TARGET_SUBMIT]: (payload) => submit(payload, { log }),
      [MessageType.PROVIDER_DIAGNOSE]: () => snapshot(),
    },
    destroy() {},
  };
}
