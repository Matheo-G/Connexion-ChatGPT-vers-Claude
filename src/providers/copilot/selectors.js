/**
 * @file Every Copilot (copilot.cloud.microsoft) DOM assumption, in one place.
 *
 * The chat composer is a Lexical editor (Meta's framework):
 *   <… id="m365-chat-editor-target-element" contenteditable="true"
 *        data-lexical-editor="true" role="textbox">
 * Lexical reverts direct DOM edits; only a synthetic paste is accepted, which
 * utils/rich-text-input.js tries first (selection synced beforehand).
 * Selectors not confirmed on a live page are generic fallbacks: use the
 * popup diagnostic ("Copier le diagnostic Copilot") to adjust them.
 */

export const SELECTORS = Object.freeze({
  editor: [
    '#m365-chat-editor-target-element',
    '[data-lexical-editor="true"][contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    'textarea#userInput',
  ],
  sendButton: [
    'button.fai-SendButton',
    'button[aria-label="Envoyer"]',
    'button[aria-label="Send"]',
    'button[aria-label*="envoyer" i]',
    'button[aria-label*="send" i]',
    'button[type="submit"]',
  ],
  composer: ['form', '[class*="ChatInput"]', '[class*="chatInput"]', '[role="group"]'],
  /** Microsoft sign-in usually happens on another host (login.microsoftonline.com). */
  loginForm: ['input[name="loginfmt"]', 'form[action*="login.microsoftonline.com"]'],
});

/** Sign-in screens served on the Copilot hosts themselves. */
export const AUTH_PATHS = Object.freeze(['/login', '/auth', '/signin']);

/** Usage / capacity limit banners (FR/EN), searched around the composer. */
export const RATE_LIMIT_PATTERNS = Object.freeze([
  /limite (de|d.)(messages|utilisation|conversation)/i,
  /reached (the|your) (daily |message |conversation )?limit/i,
  /trop de (messages|demandes)/i,
  /too many (requests|messages)/i,
]);
