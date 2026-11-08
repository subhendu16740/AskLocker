// asklocker.com's public pages, written into dist/ after `expo export`.
//
// The app is a single-page export: one index.html that draws every screen
// with JavaScript, which search engines and AI assistants mostly see as an
// empty page. This writes plain HTML beside it, for them and for anyone
// deciding whether to try AskLocker:
//
//   landing.html          served at / by dist/_redirects ("/ /landing 200")
//   videos.html           /videos, every film
//   videos/<slug>.html    /videos/<slug>, one film, its transcript and chapters
//   privacy.html          /privacy, the privacy policy
//   media/                the films' files and the share card
//   robots.txt  sitemap.xml  llms.txt  llms-full.txt
//
// The app keeps every other address: Cloudflare Pages still answers any
// address without a file of its own with the app's index.html (its
// single-page fallback), and a _redirects rule applies only to its own path.
// The landing page hands the app's own visitors on (a sign-in coming back,
// the installed app, someone signed in): see APP_FORWARD in lib/html.mjs.
//
// Production (the build names the PROD Supabase project, as the app decides
// it in src/lib/environment.ts): indexable, published films only. Any other
// build (DEV, a preview, a build without .env): every page noindex,
// robots.txt shuts everything, and drafts are shown, marked Draft, for review.
//
//   node site/build.mjs [dist]          npm run build runs this
//   node site/build.mjs --preview       site/out/, the landing page also as
//                                       index.html, for any static server
//   node site/build.mjs --preview --production
//                                       what production would publish

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { landingPage } from './pages/landing.mjs';
import { filmsIndexPage, watchPage } from './pages/films.mjs';
import { privacyPage } from './pages/privacy.mjs';
import { llmsFullTxt, llmsTxt, robotsTxt, sitemapXml } from './pages/machine.mjs';
import { loadVideos } from './lib/videos.mjs';
import { LANDING_RULE, PUBLIC_PATHS, SITE_NAMES, appRoutes } from './lib/routes.mjs';

const PROD_REF = 'yrcmdixqgvmhqxejvlor';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = fileURLToPath(new URL('.', import.meta.url));

/** Files this writes at the top; public/ must not hold them too. */
const SITE_FILES = ['robots.txt', 'sitemap.xml', 'llms.txt', 'llms-full.txt', 'landing.html', 'videos.html', 'privacy.html'];

const args = process.argv.slice(2);
const preview = args.includes('--preview');
const forceProduction = args.includes('--production');
const out = preview ? join(SITE, 'out') : (args.find((a) => !a.startsWith('--')) ?? 'dist');

function log(message) { console.log(`[site] ${message}`); }
function stop(messages) {
  for (const m of [].concat(messages)) console.error(`[site] ${m}`);
  process.exit(1);
}

function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function main() {
  // `expo export` reads .env itself; this step reads it too, as
  // scripts/lab-pages.mjs does, without overriding the host's values.
  if (existsSync(join(ROOT, '.env')) && typeof process.loadEnvFile === 'function') {
    try { process.loadEnvFile(join(ROOT, '.env')); } catch { /* the host's values stand */ }
  }
  const production = forceProduction || (!preview && (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').includes(PROD_REF));

  const routes = appRoutes();
  const clash = SITE_NAMES.filter((n) => routes.has(n));
  if (clash.length) stop(`src/app has a route the site uses (${clash.join(', ')}): rename one, or the site would hide the app's screen.`);

  if (preview) {
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
  } else {
    if (!existsSync(join(out, 'index.html'))) stop(`No ${out}/index.html: run after \`expo export\` (npm run build does).`);
    const taken = SITE_FILES.filter((f) => existsSync(join(out, f)));
    if (taken.length) stop(`${out} already has ${taken.join(', ')} (from public/?). The site writes these: edit site/, not public/.`);
  }

  const { videos, errors, warnings } = loadVideos({ showDrafts: !production });
  for (const w of warnings) log(`warning: ${w}`);
  if (errors.length) stop(errors);

  const indexable = production;

  write(join(out, 'landing.html'), landingPage({ videos, indexable }));
  write(join(out, 'privacy.html'), privacyPage({ indexable, hasFilms: videos.length > 0 }));
  if (videos.length) {
    write(join(out, 'videos.html'), filmsIndexPage({ videos, indexable }));
    for (const v of videos) {
      write(join(out, 'videos', `${v.slug}.html`), watchPage(v, { videos, indexable }));
      for (const f of v.files) {
        const to = join(out, 'media', 'videos', v.slug, f.name);
        mkdirSync(dirname(to), { recursive: true });
        copyFileSync(f.path, to);
      }
    }
  }
  for (const name of readdirSync(join(SITE, 'media'))) {
    const to = join(out, 'media', 'site', name);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(SITE, 'media', name), to);
  }

  write(join(out, 'robots.txt'), robotsTxt({ production, appRoutes: routes, publicPaths: PUBLIC_PATHS }));
  write(join(out, 'sitemap.xml'), sitemapXml({ videos }));
  write(join(out, 'llms.txt'), llmsTxt({ videos }));
  write(join(out, 'llms-full.txt'), llmsFullTxt({ videos }));

  // The one rule: / is the landing page. Any rules public/_redirects
  // brought along stay, after it (the first rule for a path wins).
  const redirectsPath = join(out, '_redirects');
  const existing = existsSync(redirectsPath) ? readFileSync(redirectsPath, 'utf8') : '';
  if (!existing.split('\n').some((l) => l.trim() === LANDING_RULE)) {
    write(redirectsPath, `# Written by site/build.mjs: asklocker.com/ is the landing page (dist/landing.html).\n# Every other address is the app's, through Cloudflare Pages' single-page fallback.\n${LANDING_RULE}\n${existing}`);
  }

  if (preview) {
    // A plain static server knows no _redirects: show the landing page at /,
    // and bring the pages and images it links to.
    copyFileSync(join(out, 'landing.html'), join(out, 'index.html'));
    for (const f of ['icon-192.png', 'icon-512.png', 'favicon.svg', 'favicon-32.png']) copyFileSync(join(ROOT, 'public', f), join(out, f));
  }

  const drafts = videos.filter((v) => v.draft).length;
  log(`${production ? 'Production' : 'Not production (noindex, drafts shown)'}: wrote the landing page, the privacy policy, ${videos.length - drafts} published film(s)${drafts ? ` and ${drafts} draft(s)` : ''}, robots.txt, sitemap.xml, llms.txt and llms-full.txt into ${out}.`);
}

main();
