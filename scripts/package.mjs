/**
 * Builds the distributable extension: dist/matheo-ai-router-<version>.zip
 *
 *   npm run package
 *
 * The archive holds only what Chrome needs (manifest, _locales, src/ without
 * the folder READMEs) — no tests, docs, node_modules or tooling. It can be
 * uploaded as is to the Chrome Web Store, or unzipped and loaded with
 * "Load unpacked". Pure Node (zlib), no dependency: works on Windows too.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const INCLUDE = ['manifest.json', '_locales', 'src'];
/** Docs and the developer-only workflow template stay out of the package. */
const EXCLUDE = [/\.md$/i, /(^|\/)\.DS_Store$/, /_template\.workflow\.js$/];

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const outDir = path.join(ROOT, 'dist');
const outFile = path.join(outDir, `matheo-ai-router-${manifest.version}.zip`);

/** All files to package, as archive paths with forward slashes, sorted. */
function collect() {
  const files = [];
  const walk = (relative) => {
    const absolute = path.join(ROOT, relative);
    if (fs.statSync(absolute).isDirectory()) {
      for (const name of fs.readdirSync(absolute)) walk(path.join(relative, name));
    } else {
      const archivePath = relative.split(path.sep).join('/');
      if (!EXCLUDE.some((pattern) => pattern.test(archivePath))) files.push(archivePath);
    }
  };
  INCLUDE.forEach(walk);
  return files.sort();
}

// ---- Minimal ZIP writer (deflate, no data descriptors) -----------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** DOS date/time of a fixed instant: identical inputs give an identical archive. */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory header
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += local.length + nameBytes.length + compressed.length;
  }

  const centralSize = centrals.reduce((size, buffer) => size + buffer.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

// ---- Build ----------------------------------------------------------------------

const files = collect();
const archive = zip(files.map((name) => ({ name, data: fs.readFileSync(path.join(ROOT, name)) })));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, archive);
console.info(`✓ ${path.relative(ROOT, outFile)} — ${files.length} files, ${(archive.length / 1024).toFixed(1)} KB`);
