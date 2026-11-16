/**
 * @file Default workflow: forwards the answer as is (plus the user's
 * personal instructions, if any were written in the options).
 */

/** @type {import('./registry.js').Workflow} */
export default Object.freeze({
  id: 'default',
  command: null,
  labelKey: 'workflowDefault',
  label: 'Envoyer tel quel',
  icon: 'send',
  transform: ({ text, notes = '' }) => (notes.trim() ? `${text}\n\n---\n\n${notes.trim()}` : text),
});
