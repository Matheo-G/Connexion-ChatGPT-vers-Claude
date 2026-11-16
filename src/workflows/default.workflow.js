/**
 * @file Default workflow: forwards the answer as is.
 */

/** @type {import('./registry.js').Workflow} */
export default Object.freeze({
  id: 'default',
  command: null,
  labelKey: 'workflowDefault',
  label: 'Envoyer tel quel',
  icon: 'send',
  transform: ({ text }) => text,
});
