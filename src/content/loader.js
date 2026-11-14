/**
 * @file Content script entry point — a classic script on purpose.
 *
 * Chrome cannot declare ES-module content scripts, so this tiny loader
 * imports the real runtime with a dynamic import() of an extension URL
 * (listed in web_accessible_resources).
 *
 * It may run twice in the same page (declarative injection + programmatic
 * injection by background/injector.js). The guard below makes it
 * idempotent, while still allowing a fresh boot when the previous instance
 * is orphaned (extension reloaded/updated: its chrome.runtime.id is gone).
 */
(() => {
  const KEY = '__aiRouterInstance';
  const existing = globalThis[KEY];
  if (existing?.runtime?.id) return; // a live instance already runs here

  const instance = { runtime: chrome.runtime, startedAt: Date.now() };
  globalThis[KEY] = instance;

  // The runtime receives a release() callback so that, once torn down, it can
  // free the slot for a later injection — but only if the slot is still its own.
  const release = () => {
    if (globalThis[KEY] === instance) delete globalThis[KEY];
  };

  import(chrome.runtime.getURL('src/content/runtime.js'))
    .then((module) => module.boot({ release }))
    .catch((error) => {
      console.error('[AI Router · loader] Boot failed', error);
      release(); // allow a later injection to retry
    });
})();
