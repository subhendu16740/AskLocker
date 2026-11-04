// The page shell every public page shares: <head> (title, description,
// canonical, robots, Open Graph, JSON-LD), header and footer, and the icons.
// Pages are plain HTML and CSS: everything a person, a search engine or an
// AI agent needs is in the HTML itself, with no script required to read it.

import { readFileSync } from 'node:fs';
import { SITE_URL, SUPPORT_EMAIL } from './facts.mjs';

const CSS = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s*\n\s*/g, '\n')
  .trim();

/** Text into HTML. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** An absolute address on the site, for canonical, Open Graph and JSON-LD. */
export function abs(path) {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Plain text with the support address made a link. */
export function linkify(text) {
  return esc(text).replace(SUPPORT_EMAIL, `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`);
}

/** JSON-LD, safe inside <script>. */
function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

// Feather icons (MIT), the set the app uses (CLAUDE.md, Conventions).
// Fingerprint UI uses "aperture": Feather has no fingerprint.
const ICONS = {
  'message-circle': '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  aperture: '<circle cx="12" cy="12" r="10"/><line x1="14.31" y1="8" x2="20.05" y2="17.94"/><line x1="9.69" y1="8" x2="21.17" y2="8"/><line x1="7.38" y1="12" x2="13.12" y2="2.06"/><line x1="9.69" y1="16" x2="3.95" y2="6.06"/><line x1="14.31" y1="16" x2="2.83" y2="16"/><line x1="16.62" y1="12" x2="10.88" y2="21.94"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  'arrow-right': '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
  'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
  'chevron-left': '<polyline points="15 18 9 12 15 6"/>',
  'refresh-cw': '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  'bar-chart-2': '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  'edit-3': '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
};

export function icon(name, size = 24) {
  const body = ICONS[name];
  if (!body) throw new Error(`site: no icon "${name}"`);
  return `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** The app's mark, the question lock (assets/expo.icon/Assets/asklocker-mark.svg), on its navy square. */
export function logo(size = 36) {
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 1024 1024" aria-hidden="true"><rect width="1024" height="1024" rx="230" fill="#2A3D66"/><path d="M362 408V372c0-90 66-152 150-152s150 58 150 140c0 70-44 102-96 128-34 17-54 40-54 82" fill="none" stroke="#fff" stroke-width="88" stroke-linecap="round"/><path fill="#fff" fill-rule="evenodd" d="M348 556H676A76 76 0 0 1 752 632V780A76 76 0 0 1 676 856H348A76 76 0 0 1 272 780V632A76 76 0 0 1 348 556Z M489.1 716A46 46 0 1 1 534.9 716L544 766c2 11-6 20-17 20h-30c-11 0-19-9-17-20Z"/></svg>`;
}

/**
 * Only on the landing page, and first in <head>, before anything is drawn.
 *
 * asklocker.com/ was the app's own start until this page took the address,
 * so three visitors still belong in the app:
 *  1. A sign-in coming back. Google's redirect sign-in returns to the site's
 *     root (auth.tsx: redirectTo is window.location.origin) with ?code=, and
 *     Supabase's email links come back there too. The app exchanges the code
 *     with this browser's PKCE verifier, so it is handed on, query and hash
 *     whole, to /home, where the app signs the person in exactly as it did at /.
 *  2. The installed app (Home Screen, standalone): it opens the app, as
 *     public/manifest.json's start_url always has.
 *  3. Someone signed in on this browser (Supabase's sb-<project>-auth-token
 *     in localStorage) who typed the address: their vault, as before. Not
 *     when they came from one of the site's own pages, so the logo still
 *     leads to this page.
 * Search engines and agents are none of these, and read the page.
 */
export const APP_FORWARD = `(function(){try{var l=location,q=l.search,h=l.hash;
if(/[?&#](code|error|error_description|token_hash|access_token|refresh_token)=/.test(q+h)){l.replace('/home'+q+h);return}
var s=false;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^sb-[a-z0-9]+-auth-token$/.test(k)&&localStorage.getItem(k)){s=true;break}}
var app=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
var r=document.referrer,own=false;try{own=!!r&&new URL(r).origin===l.origin}catch(e){}
if(app)l.replace(s?'/home':'/onboarding');else if(s&&!own&&!/^#(family|business)$/.test(h))l.replace('/home');}catch(e){}})();`;

const NAV = [
  { href: '/#films', label: 'Films', when: 'films' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#business', label: 'Business' },
  { href: '/#faq', label: 'FAQ' },
];

// The app's top bar: 56 tall, the name in its title style.
function header({ hasFilms }) {
  const links = NAV.filter((n) => n.when !== 'films' || hasFilms)
    .map((n) => `<a href="${n.href}">${n.label}</a>`)
    .join('');
  return `<header class="top">
<div class="wrap top-in">
<a class="brand" href="/" aria-label="AskLocker home">${logo(32)}<span>AskLocker</span></a>
<nav class="nav" aria-label="Main">${links}</nav>
<div class="top-cta"><a class="btn btn-text" href="/login">Sign in</a><a class="btn btn-primary" href="/onboarding">Get started</a></div>
</div>
</header>`;
}

function footer({ hasFilms }) {
  const year = new Date().getUTCFullYear();
  return `<footer class="foot">
<div class="wrap foot-in">
<nav class="foot-links" aria-label="Footer">${hasFilms ? '<a href="/videos">Films</a>' : ''}<a href="/privacy">Privacy policy</a><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a><a href="/llms.txt">For AI assistants</a></nav>
<p class="foot-note">© ${year} AskLocker</p>
</div>
</footer>`;
}

/**
 * A whole page.
 *  path       the page's own address ("/", "/videos", "/videos/family-film")
 *  indexable  false for every page of a build that is not production, and
 *             for drafts: they may be reviewed but never indexed
 *  forward    the landing page's hand-on to the app (above)
 */
export function page({ path, title, description, body, jsonLdGraph, og = {}, indexable, forward = false, hasFilms = false, headExtra = '', bodyAttrs = '' }) {
  const url = abs(path);
  const image = og.image ?? abs('/media/site/og-card.jpg');
  const robots = indexable
    ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    : 'noindex, nofollow';
  const ogExtra = (og.extra ?? []).map(([p, c]) => `<meta property="${p}" content="${esc(c)}">`).join('\n');
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
${forward ? `<script>${APP_FORWARD}</script>\n` : ''}<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#2A3D66">
<link rel="icon" href="/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="/icon-192.png">
<link rel="alternate" type="text/markdown" href="/llms-full.txt" title="AskLocker as Markdown, for AI assistants">
<meta property="og:site_name" content="AskLocker">
<meta property="og:locale" content="en_IN">
<meta property="og:type" content="${og.type ?? 'website'}">
<meta property="og:title" content="${esc(og.title ?? title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(image)}">
${og.image ? '' : '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'}<meta property="og:image:alt" content="${esc(og.imageAlt ?? 'AskLocker: every family document, one question away')}">
${ogExtra}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(og.title ?? title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@graph': jsonLdGraph })}</script>
<style>${CSS}</style>
${headExtra}</head>
<body${bodyAttrs ? ` ${bodyAttrs}` : ''}>
<a class="skip" href="#main">Skip to content</a>
${header({ hasFilms })}
<main id="main">
${body}
</main>
${footer({ hasFilms })}
</body>
</html>
`;
}

/** The site's publisher and the site, the first two nodes of every page's graph. */
export function orgAndSite() {
  return [
    {
      '@type': 'Organization',
      '@id': abs('/#org'),
      name: 'AskLocker',
      alternateName: ['Ask Locker', 'asklocker.com'],
      url: abs('/'),
      logo: { '@type': 'ImageObject', url: abs('/icon-512.png'), width: 512, height: 512 },
      email: SUPPORT_EMAIL,
      contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: SUPPORT_EMAIL, availableLanguage: ['en', 'hi'] },
    },
    {
      '@type': 'WebSite',
      '@id': abs('/#website'),
      url: abs('/'),
      // Google's site name for the results: the name, and how else people
      // write it, so "ask locker" is read as this site, not "app locker".
      name: 'AskLocker',
      alternateName: ['Ask Locker', 'asklocker.com'],
      inLanguage: 'en-IN',
      publisher: { '@id': abs('/#org') },
    },
  ];
}

/** 135 -> "2:15". */
export function clock(seconds) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 135 -> "PT2M15S", for VideoObject.duration. */
export function isoDuration(seconds) {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return `PT${m ? `${m}M` : ''}${s % 60}S`;
}
