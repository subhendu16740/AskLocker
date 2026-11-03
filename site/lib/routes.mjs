// Where the site and the app meet: which addresses are the app's, and which
// the site writes. build.mjs refuses to build when they overlap, and the QA
// self-test checks the same.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = fileURLToPath(new URL('../../src/app/', import.meta.url));

/** The rule in dist/_redirects that puts the landing page at /. */
export const LANDING_RULE = '/ /landing 200';

/** Top-level names the site writes; none may be an app route. */
export const SITE_NAMES = ['landing', 'videos', 'media'];

/** Public files that robots.txt must let through, whatever the app's routes start with. */
export const PUBLIC_PATHS = ['/sitemap.xml', '/llms.txt', '/llms-full.txt', '/privacy', '/videos', '/media/'];

/** The app's top-level routes, from src/app (expo-router: the file path is the route). */
export function appRoutes(dir = APP_DIR) {
  const routes = new Set();
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (/^\(.*\)$/.test(name)) for (const r of appRoutes(full)) routes.add(r); // a group adds no segment
      else routes.add(name);
    } else {
      const base = name.replace(/\.(web\.)?(tsx?|jsx?)$/, '');
      if (base === name || base.startsWith('_') || base.startsWith('+') || base === 'index') continue;
      routes.add(base);
    }
  }
  return routes;
}
