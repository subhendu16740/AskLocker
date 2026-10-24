// After `expo export`: move dist/assets/node_modules to dist/assets/vendor,
// and point the built files at the new folder.
//
// Expo writes assets that come from packages (the icon fonts, expo-router's
// and react-navigation's images) under dist/assets/node_modules/…, and
// Cloudflare Pages does not publish a folder named node_modules. On
// asklocker.com, served by Cloudflare from 24 October 2026, every icon
// became an empty box: the font's address answered with the app's page
// instead (the single-page fallback). A browser that still had the font
// from Vercel showed the icons, so it looked fine on a computer and broke
// on a phone.
//
// The rename is safe anywhere: Vercel serves the folder under either name.
//
//   node scripts/move-node-modules-assets.mjs [dist]

import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const from = join(dist, 'assets', 'node_modules');
const to = join(dist, 'assets', 'vendor');
const OLD = '/assets/node_modules/';
const NEW = '/assets/vendor/';
const TEXT = /\.(js|html|css|json|map|txt)$/;

if (!existsSync(from)) {
  console.log(`[assets] No ${from}; nothing to move.`);
  process.exit(0);
}
if (existsSync(to)) {
  console.error(`[assets] ${to} already exists; not moving ${from} over it.`);
  process.exit(1);
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

renameSync(from, to);

let changed = 0;
for (const path of files(dist)) {
  if (!TEXT.test(path)) continue;
  const text = readFileSync(path, 'utf8');
  if (!text.includes(OLD)) continue;
  writeFileSync(path, text.split(OLD).join(NEW));
  changed++;
}

// Nothing may still point at the old folder: it is not published.
const left = [...files(dist)].filter((p) => TEXT.test(p) && readFileSync(p, 'utf8').includes(OLD));
if (left.length) {
  console.error(`[assets] Still pointing at ${OLD}: ${left.join(', ')}`);
  process.exit(1);
}
console.log(`[assets] Moved ${from} to ${to}; ${changed} file(s) now point at ${NEW}.`);
