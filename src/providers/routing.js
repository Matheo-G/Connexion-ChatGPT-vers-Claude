/**
 * @file Destination named in the user's message ("… envoie-le à Copilot").
 *
 * With voice dictation (Whisper Flow), the user says where the result must
 * go. Only explicit routing phrases count, so that a sentence merely
 * mentioning "Claude" (a first name!) or "Copilot" never reroutes a send:
 *
 *   - a sending verb followed by the AI:   "envoie-le à Copilot", "transmets ça dans Claude",
 *                                          "envoie le résultat sur Copilot"
 *   - a closing "dans/sur/vers/via X":     "… crée l'écran, sur Copilot."
 *
 * Pure module (no DOM): used by the pipeline, the ChatGPT button and the workflows.
 */

import { listProviders } from './registry.js';

const VERB =
  '(?:envoie|envoies|envoyez|envoyer|renvoie|transmets|transmettez|transmettre|passe|passez|passer|donne|donnez|donner|balance|mets|mettez|poste|postez|colle|collez|send|forward)';
/** Optional object pronoun or noun group between the verb and the destination. */
const OBJECT = "(?:[- ](?:le|la|les|lui|moi))?(?:\\s+(?:ça|ca|cela|tout|ce\\s+\\p{L}+|cette\\s+\\p{L}+|le\\s+\\p{L}+|la\\s+\\p{L}+|les\\s+\\p{L}+|it|this))?";
const TO = "(?:à|a|au|dans|vers|sur|chez|via|avec|to|in|into)";
const START = '(?<![\\p{L}\\p{N}])';
const END = '(?![\\p{L}\\p{N}])';

function targets() {
  return listProviders().filter((p) => p.roles.includes('target'));
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function patterns(provider) {
  const names = (provider.aliases?.length ? provider.aliases : [provider.name]).map(escape).join('|');
  return [
    new RegExp(`[,;]?\\s*(?:et\\s+|puis\\s+)?${START}${VERB}${OBJECT}\\s+${TO}\\s+(?:${names})${END}`, 'iu'),
    new RegExp(`[,;]?\\s*${START}(?:dans|sur|vers|via|pour)\\s+(?:${names})${END}\\s*[.!]?\\s*$`, 'iu'),
  ];
}

/**
 * @param {string} prompt
 * @returns {{providerId: string, phrase: string} | null} The destination asked for, and the phrase that asked.
 */
export function detectTargetMention(prompt) {
  const text = String(prompt ?? '');
  let best = null;
  for (const provider of targets()) {
    for (const pattern of patterns(provider)) {
      const match = text.match(pattern);
      if (!match) continue;
      const candidate = { providerId: provider.id, phrase: match[0], end: match.index + match[0].length };
      // The last instruction wins ("… non, envoie-le à Copilot"); for overlapping
      // matches ending at the same place, the fullest phrase ("envoie ça dans X").
      const better = !best || candidate.end > best.end || (candidate.end === best.end && candidate.phrase.length > best.phrase.length);
      if (better) best = candidate;
    }
  }
  return best && { providerId: best.providerId, phrase: best.phrase };
}

/**
 * The message without its routing phrase (the destination is the extension's
 * business, not the target AI's): "Crée l'écran, envoie-le à Copilot." → "Crée l'écran."
 * @param {string} prompt
 */
export function stripTargetMention(prompt) {
  const text = String(prompt ?? '');
  const mention = detectTargetMention(text);
  if (!mention) return text.trim();
  return text
    .replace(mention.phrase, '')
    .replace(/\s+([.!?,;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,;]\s*$/, '')
    .trim();
}
