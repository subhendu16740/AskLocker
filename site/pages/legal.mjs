// asklocker.com/terms, /refunds and /contact: the pages Razorpay's website
// review, the Play Store and India's IT Rules ask for, in the privacy page's
// design (pages/privacy.mjs). Their words are `terms`, `refunds` and
// `contact` in content.mjs. Written to dist/<name>.html, which Cloudflare
// Pages serves at /<name>. Plain HTML, no script, so they open anywhere.

import { contact, refunds, terms } from '../content.mjs';
import { abs, esc, linkify, orgAndSite, page } from '../lib/html.mjs';
import { policyDate } from './privacy.mjs';

export const LEGAL_PAGES = [terms, refunds, contact];

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function part(s) {
  const id = slug(s.title);
  const rows = s.rows
    .map(([title, text]) => `<div class="row"><div><p class="label">${esc(title)}</p><p class="caption">${linkify(text)}</p></div></div>`)
    .join('');
  return `<section class="policy-part" id="${id}" aria-labelledby="${id}-h">
<h2 class="overline" id="${id}-h">${esc(s.title)}</h2>
<div class="card">${rows}</div>${s.note ? `\n<p class="caption policy-note">${esc(s.note)}</p>` : ''}
</section>`;
}

/** A page's words as plain text, for the self-test. */
export function legalText(doc) {
  return [
    doc.title,
    `Last updated ${policyDate(doc.updated)}`,
    doc.intro,
    ...doc.sections.flatMap((s) => [s.title, ...s.rows.map(([t, x]) => `${t}: ${x}`), ...(s.note ? [s.note] : [])]),
  ].join('\n');
}

export function legalPage(doc, { indexable, hasFilms }) {
  const body = `<div class="wrap watch narrow">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">AskLocker</a> › ${esc(doc.title)}</nav>
<h1>${esc(doc.title)}</h1>
<p class="caption">Last updated ${policyDate(doc.updated)}</p>
<p class="lead">${linkify(doc.intro)}</p>
${doc.sections.map(part).join('\n')}
</div>`;
  const url = abs(doc.path);
  const graph = [
    ...orgAndSite(),
    {
      '@type': doc.path === '/contact' ? 'ContactPage' : 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: `AskLocker ${doc.title.toLowerCase()}`,
      isPartOf: { '@id': abs('/#website') },
      about: { '@id': abs('/#org') },
      inLanguage: 'en-IN',
      dateModified: doc.updated,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'AskLocker', item: abs('/') },
          { '@type': 'ListItem', position: 2, name: doc.title, item: url },
        ],
      },
    },
  ];
  return page({
    path: doc.path,
    title: `${doc.title} · AskLocker`,
    description: doc.description,
    body,
    jsonLdGraph: graph,
    indexable,
    hasFilms,
  });
}
