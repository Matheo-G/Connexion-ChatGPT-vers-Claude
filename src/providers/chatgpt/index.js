/**
 * @file ChatGPT provider — metadata only (no DOM access, safe in the service worker).
 * DOM logic lives in adapter.js, loaded in the page by the content runtime.
 */

/** @type {import('../registry.js').ProviderDefinition} */
export default Object.freeze({
  id: 'chatgpt',
  name: 'ChatGPT',
  matches: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
  newChatUrl: 'https://chatgpt.com/',
  roles: Object.freeze(['source']),
  /** Also receives the results sent back from Claude ("↩ ChatGPT", step 9). */
  receivesReturns: true,
  adapterPath: 'src/providers/chatgpt/adapter.js',
});
