/**
 * @file Microsoft Copilot (work / school — "Microsoft 365 Copilot Chat"),
 * served at copilot.cloud.microsoft (formerly m365.cloud.microsoft/chat).
 * Metadata only (no DOM access, safe in the service worker).
 */

/** @type {import('../registry.js').ProviderDefinition} */
export default Object.freeze({
  id: 'copilot',
  name: 'Copilot',
  matches: ['https://copilot.cloud.microsoft/*', 'https://m365.cloud.microsoft/*'],
  newChatUrl: 'https://copilot.cloud.microsoft/chat',
  roles: Object.freeze(['target']),
  aliases: Object.freeze(['copilot', 'co-pilot', 'copilote', 'microsoft copilot']),
  adapterPath: 'src/providers/copilot/adapter.js',
});
