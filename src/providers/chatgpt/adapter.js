/**
 * @file ChatGPT DOM adapter (runs inside chatgpt.com).
 * Wires the reader, the send buttons and the diagnostic to the message bus,
 * and the generic composer writer to receive Claude's results (step 9).
 * DOM details live in reader.js / mount.js / selectors.js.
 */

import { MessageType } from '../../shared/message-types.js';
import { extract, isGenerating, describeLayout } from './reader.js';
import { snapshot } from './diagnostics.js';
import { createMounter } from './mount.js';
import { createComposerWriter } from '../shared/composer.js';
import { COMPOSER, COMPOSER_AUTH_PATHS, COMPOSER_RATE_LIMITS } from './selectors.js';

/** Writing into ChatGPT's composer (way back from Claude). */
const writer = createComposerWriter({
  name: 'ChatGPT',
  selectors: COMPOSER,
  authPaths: COMPOSER_AUTH_PATHS,
  rateLimitPatterns: COMPOSER_RATE_LIMITS,
  chatPages: /^\/(?:g\/[^/]+\/)?c\//,
  isBusy: isGenerating,
});

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
      editorFound: Boolean(writer.findEditor()),
      ...describeLayout(),
    }),
    handlers: {
      [MessageType.SOURCE_EXTRACT]: (payload) => {
        const answer = extract(payload);
        log.info(`Answer extracted (${answer.length} chars)`);
        return answer;
      },
      [MessageType.TARGET_SUBMIT]: (payload) => writer.submit(payload, { log }),
      [MessageType.PIPELINE_STATUS]: (status) => mounter.onStatus(status),
      [MessageType.PROVIDER_DIAGNOSE]: () => snapshot(),
    },
    destroy: () => mounter.stop(),
  };
}
