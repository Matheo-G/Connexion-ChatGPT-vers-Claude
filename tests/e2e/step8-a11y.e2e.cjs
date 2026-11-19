/**
 * Step 8 — accessibility: axe-core (WCAG 2.x A/AA rules) on every UI the
 * extension shows, in light and dark themes: popup, options page, the send
 * button and its workflow menu inside ChatGPT, and the error toast.
 * Run: npm run test:e2e
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launch, ROOT } = require('./harness.cjs');

const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
let h;

before(async () => {
  h = await launch();
});

after(async () => {
  await h?.close();
});

/**
 * A page in the given theme with animations off: axe measures contrast at one
 * instant, and a fade-in in progress (partial opacity) would skew the result.
 */
async function newPage(scheme) {
  const page = await h.context.newPage();
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  return page;
}

/**
 * Runs axe in the page (evaluated through DevTools: extension pages forbid
 * injected scripts by CSP) and returns readable violations.
 */
async function audit(page, include) {
  await page.evaluate(AXE);
  return page.evaluate(async (selectors) => {
    const context = selectors ? { include: selectors.map((s) => [s]) } : document;
    const { violations } = await window.axe.run(context, { resultTypes: ['violations'] });
    return violations.map((v) => `${v.impact} ${v.id} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  }, include ?? null);
}

for (const scheme of ['light', 'dark']) {
  test(`${scheme}: popup (with diagnostic tools open) has no violation`, async () => {
    const popup = await newPage(scheme);
    await popup.goto(`chrome-extension://${h.extensionId}/src/popup/popup.html`);
    await popup.locator('body[data-ready="true"]').waitFor();
    await popup.click('#tools summary');
    assert.deepEqual(await audit(popup), []);
    await popup.close();
  });

  test(`${scheme}: options page has no violation`, async () => {
    const page = await newPage(scheme);
    await page.goto(`chrome-extension://${h.extensionId}/src/options/options.html`);
    await page.locator('body[data-ready="true"]').waitFor();
    assert.deepEqual(await audit(page), []);
    await page.close();
  });

  test(`${scheme}: send button, workflow menu and error toast in ChatGPT`, async () => {
    h.control.chatgpt = { layout: 'turn-key' };
    h.control.loggedOut = true;
    const page = await newPage(scheme);
    await page.goto('https://chatgpt.com/c/demo');
    if (scheme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        document.body.style.background = '#212121';
      });
    }
    await page.locator('[data-ai-router-button]').nth(1).waitFor();
    assert.deepEqual(await audit(page, ['[data-ai-router-button]']), [], 'button');

    await page.locator('[data-ai-router-button] .more').nth(1).click();
    await page.locator('[data-ai-router-menu]').waitFor();
    assert.deepEqual(await audit(page, ['[data-ai-router-menu]']), [], 'menu');
    await page.keyboard.press('Escape');

    await page.locator('[data-ai-router-button] .main').nth(1).click();
    await page.bringToFront();
    await page.locator('[data-ai-router-toasts] .toast').waitFor({ timeout: 20_000 });
    assert.deepEqual(await audit(page, ['[data-ai-router-toasts]']), [], 'toast');

    h.control.loggedOut = false;
    for (const p of [...h.pagesOf('chatgpt.com'), ...h.pagesOf('claude.ai')]) await p.close();
  });
}
