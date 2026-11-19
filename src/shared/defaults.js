/**
 * @file Default configuration and tunable constants.
 * Centralized so behaviour can be adjusted without hunting through modules.
 */

/** Keys used in chrome.storage. Never hardcode a storage key elsewhere. */
export const StorageKey = Object.freeze({
  SETTINGS: 'settings', // chrome.storage.sync  – user preferences
  HISTORY: 'history', // chrome.storage.local – recent routing jobs
  WORKFLOW_NOTES: 'workflowNotes', // chrome.storage.local – personal instructions per workflow
});

/**
 * User preferences (validated choices of the design phase).
 * @typedef {typeof DEFAULT_SETTINGS} Settings
 */
export const DEFAULT_SETTINGS = Object.freeze({
  /** Provider id of the default destination. */
  defaultTarget: 'claude',
  /** Workflow id used by the main button. */
  defaultWorkflow: 'default',
  /** Open a fresh conversation for every send. */
  newConversation: true,
  /** Press "send" automatically after inserting the text. */
  autoSend: true,
  /** Switch back to the source tab once the message is sent. */
  returnToSource: false,
  /** Detect "/command" in the user's last ChatGPT message. */
  detectSlashCommands: true,
  /** 'auto' | 'light' | 'dark' — extension pages (the button follows the AI site). */
  theme: 'auto',
  /** Keep a local history of sends (short preview only, never leaves the browser). */
  keepHistory: true,
  /** 'normal' | 'patient' — 'patient' doubles every wait (slow connection / computer). */
  patience: 'normal',
  /** Verbose console logs in every context. */
  debugMode: false,
});

/** Timeouts in milliseconds. */
export const Timeouts = Object.freeze({
  /** Max wait for a tab to reach status "complete". */
  TAB_LOAD: 30_000,
  /** Max wait for the content script handshake after load. */
  CONTENT_READY: 10_000,
  /** Max wait for a DOM element (editor, send button…). */
  ELEMENT: 15_000,
  /** Default request/response timeout for runtime messaging. */
  MESSAGE: 15_000,
  /** Insert + send in the target page (includes waiting for the editor). */
  SUBMIT: 40_000,
  /** Full delivery as seen by a caller: tab load + handshake + submit. */
  DELIVERY: 90_000,
  /**
   * How long a UI (button, popup) waits for the background's answer: an upper
   * bound only — the background enforces the real timeouts. Must exceed the
   * worst case: "slow connection" (×2) × 2 attempts (automatic retry) of
   * tab load + handshake + submit, plus reading the source.
   */
  CALLER: 2 * 2 * (30_000 + 10_000 + 40_000) + 40_000,
});

/** Multiplier applied to waits, per `patience` setting. */
const PATIENCE_FACTOR = Object.freeze({ normal: 1, patient: 2 });

/**
 * Timeouts adapted to the user's patience setting.
 * @param {'normal' | 'patient'} [patience]
 * @returns {typeof Timeouts}
 */
export function scaleTimeouts(patience = 'normal') {
  const factor = PATIENCE_FACTOR[patience] ?? 1;
  return Object.freeze(Object.fromEntries(Object.entries(Timeouts).map(([key, ms]) => [key, ms * factor])));
}

/** Max number of entries kept in history. */
export const HISTORY_LIMIT = 50;

/** Characters of the sent text kept as a preview in history. */
export const HISTORY_PREVIEW_LENGTH = 140;

/** Allowed values of enumerated settings (validation). */
export const SETTING_CHOICES = Object.freeze({
  theme: Object.freeze(['auto', 'light', 'dark']),
  patience: Object.freeze(['normal', 'patient']),
});
