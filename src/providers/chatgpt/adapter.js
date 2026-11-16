/**
 * @file ChatGPT DOM adapter (runs inside chatgpt.com).
 * Wires the reader, the send buttons and the diagnostic to the message bus.
 * DOM details live in reader.js / mount.js / selectors.js.
 */

import { MessageType } from '../../shared/message-types.js';
import { extract, isGenerating, describeLayout } from './reader.js';
import { snapshot } from './diagnostics.js';
import { createMounter } from './mount.js';

/**
 * @param {{log: ReturnType<import('../../utils/logger.js').createLogger>}} context
 * @returns {import('../../content/runtime.js').ProviderAdapter}
 */
export function createAdapter({ log }) {
  const mounter = createMounter({ log });
  mounter.start().catch((error) => log.error('Send buttons unavailable', error));

  return {
    describe: () => ({
      path: location.pathname,
      generating: isGenerating(),
      buttons: mounter.count(),
      ...describeLayout(),
    }),
    handlers: {
      [MessageType.SOURCE_EXTRACT]: (payload) => {
        const answer = extract(payload);
        log.info(`Answer extracted (${answer.length} chars)`);
        return answer;
      },
      [MessageType.PIPELINE_STATUS]: (status) => mounter.onStatus(status),
      [MessageType.PROVIDER_DIAGNOSE]: () => snapshot(),
    },
    destroy: () => mounter.stop(),
  };
}
