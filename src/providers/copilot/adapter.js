/**
 * @file Copilot DOM adapter (runs inside copilot.cloud.microsoft): the generic
 * composer target (providers/shared/composer.js) configured with Copilot's markers.
 */

import { createComposerAdapter } from '../shared/composer.js';
import { SELECTORS, AUTH_PATHS, RATE_LIMIT_PATTERNS } from './selectors.js';

/** @type {(context: {log: Object}) => import('../../content/runtime.js').ProviderAdapter} */
export const createAdapter = createComposerAdapter({
  name: 'Copilot',
  selectors: SELECTORS,
  authPaths: AUTH_PATHS,
  rateLimitPatterns: RATE_LIMIT_PATTERNS,
  chatPages: /^\/chat/,
});
