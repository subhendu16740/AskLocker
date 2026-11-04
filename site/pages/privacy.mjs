// asklocker.com/privacy: the privacy policy, in the site's own design (the
// header, footer and Settings-style cards of every other page). Its words are
// `policy` in content.mjs. Written to dist/privacy.html, which Cloudflare
// Pages serves at /privacy (and /privacy.html, which the web app's
// Settings › Privacy opens, on any host). Plain HTML, no script, so it opens
// anywhere, the installed app included: it carries no forwarder.

import { policy } from '../content.mjs';
import { abs, esc, linkify, orgAndSite, page } from '../lib/html.mjs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-11-04" -> "4 November 2026". */
export function policyDate(ymd = policy.updated) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function part(s) {
  const id = slug(s.title);
  const rows = s.rows
    .map(([title, text]) => `<div class="row"><div><p class="label">${esc(title)}</p><p class="caption">${esc(text)}</p></div></div>`)
    .join('');
  return `<section class="policy-part" id="${id}" aria-labelledby="${id}-h">
<h2 class="overline" id="${id}-h">${esc(s.title)}</h2>
<div class="card">${rows}</div>${s.note ? `\n<p class="caption policy-note">${esc(s.note)}</p>` : ''}
</section>`;
}

/** The policy as plain text, for the self-test and llms-full.txt. */
export function policyText() {
  return [
    `Last updated ${policyDate()}`,
    policy.intro,
    ...policy.sections.flatMap((s) => [s.title, ...s.rows.map(([t, x]) => `${t}: ${x}`), ...(s.note ? [s.note] : [])]),
  ].join('\n');
}

export function privacyPage({ indexable, hasFilms }) {
  const body = `<div class="wrap watch narrow">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">AskLocker</a> › Privacy policy</nav>
<h1>Privacy policy</h1>
<p class="caption">Last updated ${policyDate()}</p>
<p class="lead">${linkify(policy.intro)}</p>
${policy.sections.map(part).join('\n')}
</div>`;
  const url = abs('/privacy');
  const graph = [
    ...orgAndSite(),
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: 'AskLocker privacy policy',
      isPartOf: { '@id': abs('/#website') },
      about: { '@id': abs('/#org') },
      inLanguage: 'en-IN',
      dateModified: policy.updated,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'AskLocker', item: abs('/') },
          { '@type': 'ListItem', position: 2, name: 'Privacy policy', item: url },
        ],
      },
    },
  ];
  return page({
    path: '/privacy',
    title: 'Privacy policy · AskLocker',
    description: 'What AskLocker keeps, who else gets it, and what you can do about it.',
    body,
    jsonLdGraph: graph,
    indexable,
    hasFilms,
  });
}
