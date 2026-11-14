/**
 * E2E harness: launches Chromium with the unpacked extension and serves
 * local fixtures in place of claude.ai / chatgpt.com (no network, no login).
 *
 * Requires Playwright (dev only). HEADED=1 shows the browser.
 */

const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const FIXTURES = path.join(__dirname, 'fixtures');
const SITES = /^https:\/\/(claude\.ai|chatgpt\.com|chat\.openai\.com)\//;

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(path.join(globalRoot, 'playwright'));
  }
}

function fixtureFor(url) {
  const host = new URL(url).hostname;
  return path.join(FIXTURES, host === 'claude.ai' ? 'claude.html' : 'chatgpt.html');
}

/**
 * @returns {Promise<{
 *   context: import('playwright').BrowserContext,
 *   sw: import('playwright').Worker,
 *   extensionId: string,
 *   control: { hang: RegExp | null },
 *   sendMessage: (message: object) => Promise<any>,
 *   evalSW: (fn: Function, arg?: any) => Promise<any>,
 *   pagesOf: (host: string) => import('playwright').Page[],
 *   close: () => Promise<void>,
 * }>}
 */
async function launch() {
  const { chromium } = loadPlaywright();
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: !process.env.HEADED,
    args: [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`],
  });

  /** Set control.hang to a RegExp to leave matching requests pending forever. */
  const control = { hang: null };
  await context.route(SITES, (route) => {
    if (control.hang?.test(route.request().url())) return; // never answered
    return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(fixtureFor(route.request().url())) });
  });

  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(sw.url()).host;

  // An extension page used to send runtime messages like the popup does.
  const probe = await context.newPage();
  await probe.goto(`chrome-extension://${extensionId}/src/options/options.html`);

  return {
    context,
    sw,
    extensionId,
    control,
    sendMessage: (message) => probe.evaluate((m) => chrome.runtime.sendMessage(m), message),
    evalSW: (fn, arg) => sw.evaluate(fn, arg),
    pagesOf: (host) => context.pages().filter((p) => p.url().includes(host)),
    close: () => context.close(),
  };
}

module.exports = { launch, ROOT };
