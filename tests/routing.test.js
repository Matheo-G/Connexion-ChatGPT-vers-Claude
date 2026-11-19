/**
 * Unit tests for the destination named in the user's (often dictated) message.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectTargetMention, stripTargetMention } from '../src/providers/routing.js';

const target = (prompt) => detectTargetMention(prompt)?.providerId ?? null;

test('explicit sending phrases pick the destination', () => {
  assert.equal(target('/figma crée un écran de connexion, envoie-le à Copilot.'), 'copilot');
  assert.equal(target('/code corrige ce bug et envoie ça dans Claude'), 'claude');
  assert.equal(target('Résume ce texte puis envoie le résultat sur Copilot'), 'copilot');
  assert.equal(target('transmets cette réponse à Claude'), 'claude');
  assert.equal(target('Envoie à copilote'), 'copilot', 'dictation spelling');
  assert.equal(target('send it to Claude'), 'claude');
  assert.equal(target("/mail réponds au client, sur Copilot."), 'copilot', 'closing "sur X"');
});

test('a mere mention never reroutes', () => {
  assert.equal(target('Écris un mail à Claude, ma collègue, pour la réunion'), null);
  assert.equal(target('Compare Claude et Copilot pour du code'), null);
  assert.equal(target('Copilot est-il meilleur que Claude ?'), null);
  assert.equal(target('/figma crée un écran'), null);
  assert.equal(target(''), null);
  assert.equal(target(undefined), null);
});

test('the last instruction wins', () => {
  assert.equal(target("Envoie-le à Claude… non, envoie-le à Copilot"), 'copilot');
});

test('stripping removes only the routing phrase', () => {
  assert.equal(stripTargetMention('/figma crée un écran de connexion, envoie-le à Copilot.'), '/figma crée un écran de connexion.');
  assert.equal(stripTargetMention('/code corrige ce bug et envoie ça dans Claude'), '/code corrige ce bug');
  assert.equal(stripTargetMention('/mail réponds au client, sur Copilot.'), '/mail réponds au client');
  assert.equal(stripTargetMention('Écris un mail à Claude'), 'Écris un mail à Claude', 'untouched without routing');
});
