/**
 * @file Claude DOM adapter (runs inside claude.ai).
 *
 *   destination: the generic composer (providers/shared/composer.js);
 *   way back (step 9): reads Claude's answers (reader.js) and puts a
 *   "↩ ChatGPT" button under each of them (shared/return-button.js).
 */

import { MessageType } from '../../shared/message-types.js';
import { createComposerWriter, composerSnapshot } from '../shared/composer.js';
import { createReturnMounter } from '../shared/return-button.js';
import { SELECTORS, AUTH_PATHS, RATE_LIMIT_PATTERNS } from './selectors.js';
import { extract, listAnswers, describeConversation } from './reader.js';
import { conversationSection } from './diagnostics.js';
import provider from './index.js';

const CONFIG = Object.freeze({
  name: 'Claude',
  selectors: SELECTORS,
  authPaths: AUTH_PATHS,
  rateLimitPatterns: RATE_LIMIT_PATTERNS,
  chatPages: /^\/(new|chat\/|project\/)/,
});

/**
 * @param {{log: ReturnType<import('../../utils/logger.js').createLogger>}} context
 * @returns {import('../../content/runtime.js').ProviderAdapter}
 */
export function createAdapter(context) {
  const { log } = context;
  const writer = createComposerWriter(CONFIG);
  const mounter = createReturnMounter({ returnTo: provider.returnTo, listAnswers, context });
  mounter.start().catch((error) => log.error('Return buttons unavailable', error));

  return {
    describe() {
      const health = writer.health();
      const conversation = describeConversation();
      return {
        path: location.pathname,
        ...health,
        answers: conversation.answers,
        generating: conversation.generating,
        buttons: mounter.count(),
        recognized: health.recognized && conversation.recognized,
      };
    },
    handlers: {
      [MessageType.TARGET_SUBMIT]: (payload) => writer.submit(payload, { log }),
      [MessageType.SOURCE_EXTRACT]: (payload) => {
        const answer = extract(payload);
        log.info(`Claude answer extracted (${answer.length} chars)`);
        return answer;
      },
      [MessageType.PIPELINE_STATUS]: (status) => mounter.onStatus(status),
      [MessageType.PROVIDER_DIAGNOSE]: () => composerSnapshot(CONFIG, writer, [conversationSection()]),
    },
    destroy: () => mounter.stop(),
  };
}
