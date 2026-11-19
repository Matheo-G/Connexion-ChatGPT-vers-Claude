/**
 * @file Claude DOM adapter (runs inside claude.ai): the generic composer
 * target (providers/shared/composer.js) configured with Claude's page markers.
 */

import { createComposerAdapter } from '../shared/composer.js';
import { SELECTORS, AUTH_PATHS, RATE_LIMIT_PATTERNS } from './selectors.js';

/** @type {(context: {log: Object}) => import('../../content/runtime.js').ProviderAdapter} */
export const createAdapter = createComposerAdapter({
  name: 'Claude',
  selectors: SELECTORS,
  authPaths: AUTH_PATHS,
  rateLimitPatterns: RATE_LIMIT_PATTERNS,
  chatPages: /^\/(new|chat\/|project\/)/,
});
