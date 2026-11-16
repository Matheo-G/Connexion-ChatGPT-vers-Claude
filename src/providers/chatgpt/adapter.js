/**
 * @file ChatGPT DOM adapter (runs inside chatgpt.com).
 * Wires the reader to the message bus; DOM details live in reader.js / selectors.js.
 * Step 4 adds the "Send to Claude" button (mount.js).
 */

import { MessageType } from '../../shared/message-types.js';
import { extract, isGenerating, describeLayout } from './reader.js';
import { snapshot } from './diagnostics.js';

/**
 * @param {{log: ReturnType<import('../../utils/logger.js').createLogger>}} context
 * @returns {import('../../content/runtime.js').ProviderAdapter}
 */
export function createAdapter({ log }) {
  return {
    describe: () => ({
      path: location.pathname,
      generating: isGenerating(),
      ...describeLayout(),
    }),
    handlers: {
      [MessageType.SOURCE_EXTRACT]: (payload) => {
        const answer = extract(payload);
        log.info(`Answer extracted (${answer.length} chars)`);
        return answer;
      },
      [MessageType.PROVIDER_DIAGNOSE]: () => snapshot(),
    },
    destroy() {},
  };
}
