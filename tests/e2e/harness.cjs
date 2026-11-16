/**
 * E2E harness: launches Chromium with the unpacked extension and serves
 * local fixtures in place of claude.ai / chatgpt.com (no network, no login).
 *
 * Why a local HTTPS server rather than Playwright's context.route()?
 * Tabs opened by the extension itself (chrome.tabs.create) escape route
 * interception and would hit the real sites. Instead, Chromium resolves the
 * AI domains to a local server (--host-resolver-rules) that serves fixtures
 * with a throwaway self-signed certificate (--ignore-certificate-errors).
 *
 * Requires Playwright (dev only). HEADED=1 shows the browser.
 */

const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const FIXTURES = path.join(__dirname, 'fixtures');
const https = require('node:https');
const HOSTS = ['claude.ai', 'chatgpt.com', 'chat.openai.com'];

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(path.join(globalRoot, 'playwright'));
  }
}

const BUILD = path.join(FIXTURES, '.build');

/** Bundles fixture scripts (real Tiptap/ProseMirror editor) once per run. */
function buildFixtureScripts() {
  const { buildSync } = require(path.join(ROOT, 'node_modules/esbuild'));
  buildSync({
    entryPoints: [path.join(FIXTURES, 'src/claude-composer.js')],
    outdir: BUILD,
    bundle: true,
    format: 'iife',
    logLevel: 'warning',
  });
}

/**
 * Decides how to answer a request to a stubbed AI site.
 * @param {URL} url
 * @param {{fixture: object, loggedOut: boolean}} control
 */
function respond(url, control) {
  if (url.pathname.startsWith('/__fixtures/')) {
    const file = path.join(BUILD, path.basename(url.pathname));
    return { contentType: 'text/javascript', body: fs.readFileSync(file) };
  }
  if (url.hostname !== 'claude.ai') {
    return withConfig(fs.readFileSync(path.join(FIXTURES, 'chatgpt.html'), 'utf8'), control.chatgpt);
  }
  if (url.pathname.startsWith('/login')) {
    return html(fs.readFileSync(path.join(FIXTURES, 'claude-login.html'), 'utf8'));
  }
  if (control.loggedOut) {
    return { status: 302, headers: { location: 'https://claude.ai/login' } };
  }
  return withConfig(fs.readFileSync(path.join(FIXTURES, 'claude.html'), 'utf8'), control.fixture);
}

const html = (body) => ({ contentType: 'text/html', body });

/** Injects the scenario knobs as window.__FIXTURE__ before any page script. */
function withConfig(page, config) {
  const script = `<script>window.__FIXTURE__ = ${JSON.stringify(config ?? {})};</script>`;
  return html(page.replace('<head>', `<head>${script}`));
}

/** Self-signed certificate, generated once into the build folder. */
function certificate() {
  const key = path.join(BUILD, 'key.pem');
  const cert = path.join(BUILD, 'cert.pem');
  if (!fs.existsSync(cert)) {
    fs.mkdirSync(BUILD, { recursive: true });
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=fixtures" -keyout "${key}" -out "${cert}"`,
      { stdio: 'ignore' },
    );
  }
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

/** Local HTTPS server answering for every stubbed AI host. */
function startFixtureServer(control) {
  const server = https.createServer(certificate(), (req, res) => {
    const url = new URL(req.url, `https://${req.headers.host}`);
    if (control.hang?.test(url.href)) return; // never answered
    const { status = 200, headers = {}, contentType, body = '' } = respond(url, control);
    res.writeHead(status, { ...headers, ...(contentType && { 'content-type': contentType }) });
    res.end(body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/**
 * @returns {Promise<{
 *   context: import('playwright').BrowserContext,
 *   sw: import('playwright').Worker,
 *   extensionId: string,
 *   control: { hang: RegExp | null, fixture: object, chatgpt: object, loggedOut: boolean },
 *   sendMessage: (message: object) => Promise<any>,
 *   evalSW: (fn: Function, arg?: any) => Promise<any>,
 *   pagesOf: (host: string) => import('playwright').Page[],
 *   openPopup: (options?: {tools?: boolean}) => Promise<import('playwright').Page>,
 *   close: () => Promise<void>,
 * }>}
 */
async function launch() {
  buildFixtureScripts();
  const { chromium } = loadPlaywright();

  /**
   * Live knobs for the stubbed sites:
   *   hang      RegExp — matching requests are never answered;
   *   fixture   window.__FIXTURE__ of the Claude page (see fixtures/src/claude-composer.js);
   *   chatgpt   window.__FIXTURE__ of the ChatGPT page (see fixtures/chatgpt.html);
   *   loggedOut every Claude page redirects to /login.
   */
  const control = { hang: null, fixture: {}, chatgpt: {}, loggedOut: false };
  const server = await startFixtureServer(control);
  const { port } = server.address();
  const rules = HOSTS.map((host) => `MAP ${host}:443 127.0.0.1:${port}`).join(', ');

  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: !process.env.HEADED,
    args: [
      `--disable-extensions-except=${ROOT}`,
      `--load-extension=${ROOT}`,
      `--host-resolver-rules=${rules}, EXCLUDE localhost`,
      '--ignore-certificate-errors',
      '--no-proxy-server',
    ],
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
    /** Opens the popup as a tab; `tools: true` unfolds the diagnostic tools. */
    async openPopup({ tools = false } = {}) {
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
      await popup.locator('body[data-ready="true"]').waitFor();
      if (tools) await popup.click('#tools summary');
      return popup;
    },
    close: async () => {
      await context.close();
      server.closeAllConnections();
      server.close();
    },
  };
}

module.exports = { launch, ROOT };
