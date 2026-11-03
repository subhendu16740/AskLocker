// asklocker.com/ : what AskLocker is, for people, search engines and AI
// assistants, in the app's own design (styles.css). Served at / by
// dist/_redirects (see build.mjs); the app keeps every other address.

import { about, business, faq, features, hero, meta, planRows, pricingNote, privacy, steps } from '../content.mjs';
import { familyPlans, facts, rupees } from '../lib/facts.mjs';
import { abs, esc, icon, linkify, logo, orgAndSite, page } from '../lib/html.mjs';
import { filmFigure, videoObject } from './films.mjs';

const label = (id, text) => `<h2 class="overline" id="${id}-h">${esc(text)}</h2>`;

const row = (r, tag = 'div') => `<${tag} class="row"><span class="icon-box">${icon(r.icon, 18)}</span><div><p class="label">${esc(r.title)}</p><p class="caption">${esc(r.text)}</p></div></${tag}>`;

function heroSection() {
  const [first, ...rest] = hero.title.split(', ');
  return `<section class="hero">
<div class="wrap">
${logo(64)}
<h1>${esc(first)},<br>${esc(rest.join(', '))}</h1>
<p>${esc(hero.lead)}</p>
<div class="hero-cta"><a class="btn btn-white" href="/onboarding">Get started</a><a class="btn btn-glass" href="/login">Sign in</a></div>
<p class="hero-note">${esc(hero.note)}</p>
</div>
</section>`;
}

function filmsSection(videos) {
  if (!videos.length) return '';
  return `<section class="section wrap" id="films" aria-labelledby="films-h">
${label('films', 'Films')}
<div class="films">${videos.slice(0, 4).map((v) => filmFigure(v)).join('\n')}</div>
</section>`;
}

function howSection() {
  return `<section class="section wrap" id="how" aria-labelledby="how-h">
${label('how', 'How it works')}
<div class="grid grid-3">${steps.map((s) => `<div class="card step"><span class="icon-box">${icon(s.icon, 18)}</span><div><h3 class="label">${esc(s.title)}</h3><p class="caption">${esc(s.text)}</p></div></div>`).join('')}</div>
</section>`;
}

function featuresSection() {
  const half = Math.ceil(features.length / 2);
  const col = (list) => `<div class="card">${list.map((f) => row(f)).join('')}</div>`;
  return `<section class="section wrap" id="features" aria-labelledby="features-h">
${label('features', 'For the whole family')}
<div class="grid grid-2">${col(features.slice(0, half))}${col(features.slice(half))}</div>
</section>`;
}

function cell(value) {
  if (value === true) return `${icon('check', 16)}<span class="sr">Yes</span>`;
  if (value === false) return `<span class="no">${icon('minus', 16)}</span><span class="sr">No</span>`;
  return esc(value);
}

function pricingSection() {
  const col = (p) => (p.id === 'plus' ? ' class="col-plus"' : '');
  const head = familyPlans.map((p) => `<th scope="col"${col(p)}>${esc(p.name)}<small>${rupees(p.price.inr)}<span class="long"> a month</span></small></th>`).join('');
  const yearly = familyPlans.map((p) => `<td${col(p)}>${p.yearly ? `${rupees(p.yearly.inr)}` : '<span class="no">–</span>'}</td>`).join('');
  const rows = planRows.map((r) => `<tr><th scope="row">${esc(r.label)}</th>${familyPlans.map((p) => `<td${col(p)}>${cell(r.cell(p))}</td>`).join('')}</tr>`).join('');
  return `<section class="section wrap" id="pricing" aria-labelledby="pricing-h">
${label('pricing', 'Plans')}
<div class="card plans"><table>
<colgroup><col class="c-label"><col><col><col></colgroup>
<thead><tr><th scope="col"><span class="sr">Plan</span></th>${head}</tr></thead>
<tbody><tr><th scope="row">A year</th>${yearly}</tr>${rows}</tbody>
</table></div>
<p class="note">${esc(pricingNote)}</p>
<div class="card biz-card" style="margin-top:12px"><div class="row"><span class="icon-box">${icon('briefcase', 18)}</span><div><p class="label">${esc(business.title)}</p><p class="caption">${esc(business.text)}</p></div><a class="btn btn-secondary" href="${esc(business.cta.href)}">${esc(business.cta.label)}</a></div></div>
</section>`;
}

function privacySection() {
  return `<section class="section wrap" id="privacy" aria-labelledby="privacy-h">
${label('privacy', 'Privacy')}
<div class="card">${privacy.map((r) => row(r)).join('')}<a class="row" href="/privacy" style="text-decoration:none"><span class="icon-box">${icon('file-text', 18)}</span><div style="flex:1"><p class="label">Privacy policy</p><p class="caption">What we keep, and who else gets it.</p></div><span style="color:var(--meta);align-self:center">${icon('chevron-right', 18)}</span></a></div>
</section>`;
}

function faqSection() {
  return `<section class="section wrap faq" id="faq" aria-labelledby="faq-h">
${label('faq', 'Questions')}
<div class="card">${faq.map((f) => `<details><summary>${esc(f.q)}${icon('chevron-down', 18)}</summary><p>${linkify(f.a)}</p></details>`).join('')}</div>
</section>`;
}

/** The app as structured data: what it is, what it costs, what it does. */
function appNode() {
  const offers = familyPlans.map((p) => ({
    '@type': 'Offer',
    name: p.name,
    price: String(p.price.inr),
    priceCurrency: 'INR',
    url: abs('/#pricing'),
    ...(p.price.inr ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: p.price.inr, priceCurrency: 'INR', billingDuration: 'P1M', unitText: 'MONTH' } } : {}),
  }));
  return {
    '@type': 'WebApplication',
    '@id': abs('/#app'),
    name: 'AskLocker',
    url: abs('/'),
    description: about,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any, in a web browser (Android, iPhone, Windows, macOS)',
    browserRequirements: 'Requires JavaScript',
    inLanguage: 'en-IN',
    image: abs('/icon-512.png'),
    publisher: { '@id': abs('/#org') },
    offers,
    featureList: [...steps.map((s) => s.title), ...features.map((f) => f.title), business.title],
    availableLanguage: facts.voiceLanguages.map((l) => l.english),
  };
}

export function landingPage({ videos, indexable }) {
  const published = videos.filter((v) => !v.draft);
  const graph = [
    ...orgAndSite(),
    {
      '@type': 'WebPage',
      '@id': abs('/#webpage'),
      url: abs('/'),
      name: meta.title,
      description: meta.description,
      isPartOf: { '@id': abs('/#website') },
      about: { '@id': abs('/#app') },
      inLanguage: 'en-IN',
      primaryImageOfPage: { '@type': 'ImageObject', url: abs('/media/site/og-card.jpg'), width: 1200, height: 630 },
    },
    appNode(),
    {
      '@type': 'FAQPage',
      '@id': abs('/#faq'),
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    ...published.map(videoObject),
  ];
  const body = [heroSection(), filmsSection(videos), howSection(), featuresSection(), pricingSection(), privacySection(), faqSection()].join('\n');
  return page({
    path: '/',
    title: meta.title,
    description: meta.description,
    body,
    jsonLdGraph: graph,
    indexable,
    forward: true,
    hasFilms: videos.length > 0,
  });
}
