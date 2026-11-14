/**
 * Dev tool — renders the brand mark into the PNG sizes required by the
 * manifest (Chrome does not accept SVG for extension/toolbar icons).
 *
 * The generated PNGs are committed, so this script is only needed when the
 * logo changes. Requires Node + Playwright (not needed to use the extension).
 *
 *   node scripts/generate-icons.mjs
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, 'src/assets/icons');
const SIZES = [16, 32, 48, 128];

// Playwright may be installed globally (CommonJS): resolve it via require.
const { chromium } = createRequire(import.meta.url)('playwright');

const { icon } = await import(path.join(ROOT, 'src/ui-kit/icons.js'));

/** Rounded indigo tile with the white logo, scaled to `size`. */
function tileHtml(size) {
  const glyph = Math.round(size * 0.68);
  const strokeWidth = size <= 16 ? 2.6 : size <= 32 ? 2.3 : 2;
  const svg = icon('logo', { size: glyph }).replace(
    'stroke-width="2"',
    `stroke-width="${strokeWidth}"`,
  );
  return `<!doctype html><html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px;display:grid;place-items:center;
      border-radius:${Math.round(size * 0.24)}px;color:#fff;
      background:linear-gradient(145deg,#6d7cff,#4a5af0)">${svg}</div></body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(tileHtml(size));
  const file = path.join(OUT_DIR, `icon-${size}.png`);
  await page.screenshot({ path: file, omitBackground: true });
  console.log('✓', path.relative(ROOT, file));
}
await browser.close();
