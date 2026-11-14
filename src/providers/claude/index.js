/**
 * @file Claude provider — metadata only (no DOM access, safe in the service worker).
 * DOM logic lives in adapter.js, loaded in the page by the content runtime.
 */

/** @type {import('../registry.js').ProviderDefinition} */
export default Object.freeze({
  id: 'claude',
  name: 'Claude',
  matches: ['https://claude.ai/*'],
  newChatUrl: 'https://claude.ai/new',
  roles: Object.freeze(['target']),
  adapterPath: 'src/providers/claude/adapter.js',
});
