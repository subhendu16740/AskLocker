// asklocker.com/ : what AskLocker is, for people, search engines and AI
// assistants, in the app's own design (styles.css). Served at / by
// dist/_redirects (see build.mjs); the app keeps every other address.
//
// Family and Business, as the app's drawer switch has them: the top of the
// page is a carousel of the two (swipe, the arrows or the dots), and every
// section below that differs between them follows it. Both are in the HTML,
// marked data-for="family" or "business"; <body data-mode> picks which one
// shows, and a business wears the app's teal (styles.css). /#business opens
// on the business slide. Without JavaScript the top still swipes, and the
// rest shows the family's.

import { about, faq, meta, modes, policy, privacy } from '../content.mjs';
import { businessColumns, familyPlans, facts, rupees } from '../lib/facts.mjs';
import { abs, esc, icon, linkify, logo, orgAndSite, page } from '../lib/html.mjs';
import { filmFigure, videoObject } from './films.mjs';
import { policyDate } from './privacy.mjs';

const MODES = [modes.family, modes.business];
const label = (id, text) => `<h2 class="overline" id="${id}-h">${esc(text)}</h2>`;
const row = (r) => `<div class="row"><span class="icon-box">${icon(r.icon, 18)}</span><div><p class="label">${esc(r.title)}</p><p class="caption">${esc(r.text)}</p></div></div>`;
/** One block per mode, only the open mode's shown. */
const perMode = (render) => MODES.map((m) => `<div data-for="${m.key}">${render(m)}</div>`).join('\n');

function heroSlide(m, i) {
  // Break before the last clause: "…, / one question away."
  const cut = m.hero.title.lastIndexOf(', ');
  const [first, last] = [m.hero.title.slice(0, cut), m.hero.title.slice(cut + 2)];
  const tag = m.key === 'business' ? 'briefcase' : 'users';
  // One h1 on the page: the family's. The business slide's title looks the same.
  const h = i === 0 ? 'h1' : 'h2';
  return `<div class="hero-slide hero-${m.key}" id="slide-${m.key}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${MODES.length}: ${esc(m.label)}">
<div class="hero-in">
${logo(64)}
<p class="hero-tag">${icon(tag, 14)}${esc(m.label)}</p>
<${h} class="hero-title">${esc(first)},<br>${esc(last)}</${h}>
<p class="hero-lead">${esc(m.hero.lead)}</p>
<div class="hero-cta"><a class="btn btn-white" href="/onboarding">Get started</a><a class="btn btn-glass" href="/login">Sign in</a></div>
<p class="hero-note">${esc(m.hero.note)}</p>
</div>
</div>`;
}

function heroSection() {
  return `<section class="hero" aria-roledescription="carousel" aria-label="AskLocker for families and for business">
<div class="hero-track" id="hero-track">
${MODES.map(heroSlide).join('\n')}
</div>
<button class="hero-arrow hero-prev" type="button" data-go="prev" aria-label="Show business">${icon('chevron-left', 22)}</button>
<button class="hero-arrow hero-next" type="button" data-go="next" aria-label="Show business">${icon('chevron-right', 22)}</button>
<div class="hero-dots">${MODES.map((m, i) => `<button class="dot" type="button" data-go="${m.key}" aria-label="${esc(m.label)}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('')}</div>
</section>`;
}

function filmsSection(videos) {
  const forMode = (m) => videos.filter((v) => v.audience === m.key || v.audience === 'everyone');
  if (!MODES.some((m) => forMode(m).length)) return '';
  return `<section class="section wrap" id="films" aria-labelledby="films-h">
${label('films', 'Films')}
${perMode((m) => {
  const list = forMode(m);
  return list.length ? `<div class="films films-${Math.min(list.length, 2)}">${list.map((v) => filmFigure(v)).join('\n')}</div>` : '';
})}
</section>`;
}

function howSection() {
  return `<section class="section wrap" id="how" aria-labelledby="how-h">
${label('how', 'How it works')}
${perMode((m) => `<div class="grid grid-3">${m.steps.map((s) => `<div class="card step"><span class="icon-box">${icon(s.icon, 18)}</span><div><h3 class="label">${esc(s.title)}</h3><p class="caption">${esc(s.text)}</p></div></div>`).join('')}</div>`)}
</section>`;
}

function featuresSection() {
  const col = (list) => `<div class="card">${list.map(row).join('')}</div>`;
  return `<section class="section wrap" id="features">
${perMode((m) => {
  const half = Math.ceil(m.features.length / 2);
  return `${label(`features-${m.key}`, m.featuresLabel)}<div class="grid grid-2">${col(m.features.slice(0, half))}${col(m.features.slice(half))}</div>`;
})}
</section>`;
}

function cell(value) {
  if (value === true) return `${icon('check', 16)}<span class="sr">Yes</span>`;
  if (value === false) return `<span class="no">${icon('minus', 16)}</span><span class="sr">No</span>`;
  return esc(value);
}

function plansTable(m) {
  const { columns, rows } = m.plans;
  const hl = (c) => (c.highlight ? ' class="col-hl"' : '');
  const head = columns.map((c) => `<th scope="col"${hl(c)}>${esc(c.name)}<small>${rupees(c.price)}<span class="long"> a month</span></small></th>`).join('');
  const yearly = columns.map((c) => `<td${hl(c)}>${c.yearly ? rupees(c.yearly) : '<span class="no">–</span>'}</td>`).join('');
  const body = rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th>${columns.map((c) => `<td${hl(c)}>${cell(r.cell(c.cells))}</td>`).join('')}</tr>`).join('');
  return `<div class="card plans plans-${columns.length}"><table>
<colgroup><col class="c-label">${columns.map(() => '<col>').join('')}</colgroup>
<thead><tr><th scope="col"><span class="sr">Plan</span></th>${head}</tr></thead>
<tbody><tr><th scope="row">A year</th>${yearly}</tr>${body}</tbody>
</table></div>`;
}

function pricingSection() {
  return `<section class="section wrap" id="pricing" aria-labelledby="pricing-h">
${label('pricing', 'Plans')}
${perMode((m) => {
  const cta = m.plans.cta
    ? `<div class="card" style="margin-top:12px"><div class="row row-center"><span class="icon-box">${icon('briefcase', 18)}</span><div style="flex:1"><p class="label">Get a business plan</p><p class="caption">${esc(m.plans.note)}</p></div><a class="btn btn-secondary" href="${esc(m.plans.cta.href)}">${esc(m.plans.cta.label)}</a></div></div>`
    : `<p class="note">${esc(m.plans.note)}</p>`;
  const o = m.other;
  const other = `<div class="card switch-card" style="margin-top:12px"><div class="row row-center"><span class="icon-box icon-${o.to}">${icon(o.icon, 18)}</span><div style="flex:1"><p class="label">${esc(o.title)}</p><p class="caption">${esc(o.text)}</p></div><a class="btn btn-secondary btn-${o.to}" href="/#${o.to}" data-go="${o.to}" data-then="pricing">${esc(o.label)}</a></div></div>`;
  return `${plansTable(m)}${cta}${other}`;
})}
</section>`;
}

// The privacy policy opens here, in place, as a line a section (the owner's
// ask, 4 November 2026: not another page). Every word of it is also at
// /privacy (pages/privacy.mjs), the address the app and Razorpay link to.
function policyRow() {
  const parts = policy.sections
    .filter((s) => s.onLanding !== false)
    .map((s) => `<div><p class="label">${esc(s.title)}</p><p class="caption">${esc(s.summary)}</p></div>`)
    .join('');
  return `<details class="policy-more">
<summary class="row"><span class="icon-box">${icon('file-text', 18)}</span><div style="flex:1"><p class="label">Privacy policy</p><p class="caption">What we keep, and who else gets it.</p></div>${icon('chevron-down', 18)}</summary>
<div class="policy-sum">${parts}<p class="caption">Updated ${policyDate()} · <a href="/privacy">Full policy</a></p></div>
</details>`;
}

function privacySection() {
  return `<section class="section wrap" id="privacy" aria-labelledby="privacy-h">
${label('privacy', 'Privacy')}
<div class="card">${privacy.map(row).join('')}${policyRow()}</div>
</section>`;
}

function faqSection() {
  return `<section class="section wrap faq" id="faq" aria-labelledby="faq-h">
${label('faq', 'Questions')}
<div class="card">${faq.map((f) => `<details><summary>${esc(f.q)}${icon('chevron-down', 18)}</summary><p>${linkify(f.a)}</p></details>`).join('')}</div>
</section>`;
}

// The carousel and the modes. Kept small, and every step is optional: the
// page reads in full without it.
const MODE_SCRIPT = `<script>(function(){var b=document.body,t=document.getElementById('hero-track');if(!t)return;b.setAttribute('data-js','');
var M=['family','business'],cur=b.getAttribute('data-mode')||'family',lock=0;
function set(m){if(m===cur)return;cur=m;b.setAttribute('data-mode',m);document.querySelectorAll('.dot').forEach(function(d){if(d.getAttribute('data-go')===m)d.setAttribute('aria-current','true');else d.removeAttribute('aria-current')});
document.querySelectorAll('.hero-arrow').forEach(function(a){a.setAttribute('aria-label',m==='business'?'Show families':'Show business')});
try{history.replaceState(null,'',m==='business'?'#business':location.pathname+location.search)}catch(e){}}
function go(m,smooth){var s=document.getElementById('slide-'+m);if(!s)return;lock=Date.now();t.scrollTo({left:s.offsetLeft,behavior:smooth?'smooth':'auto'});set(m)}
document.addEventListener('click',function(e){var el=e.target.closest('[data-go]');if(!el)return;e.preventDefault();var g=el.getAttribute('data-go');
if(g==='prev'||g==='next')g=M[(M.indexOf(cur)+1)%M.length];go(g,true);var then=el.getAttribute('data-then');if(then){var x=document.getElementById(then);if(x)x.scrollIntoView({block:'start'})}});
var timer;t.addEventListener('scroll',function(){clearTimeout(timer);timer=setTimeout(function(){if(Date.now()-lock<700)return;set(M[Math.round(t.scrollLeft/t.clientWidth)]||'family')},90)},{passive:true});
window.addEventListener('resize',function(){go(cur,false)});
function fromHash(top){var h=location.hash.slice(1);if(M.indexOf(h)>=0){go(h,false);if(top)window.scrollTo({top:0})}}
window.addEventListener('hashchange',function(){fromHash(true)});fromHash(false);
t.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(M[(M.indexOf(cur)+1)%M.length],true)}});})();
(function(){var m=document.querySelector('details.menu');if(!m)return;
document.addEventListener('click',function(e){if(m.open&&(e.target.closest('.menu-panel a')||!m.contains(e.target)))m.open=false});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&m.open){m.open=false;m.querySelector('summary').focus()}});})();</script>`;

/** The app as structured data: what it is, what it costs, what it does. */
function appNode() {
  const offer = (name, price, gst) => ({
    '@type': 'Offer',
    name,
    price: String(price),
    priceCurrency: 'INR',
    url: abs('/#pricing'),
    ...(price ? { priceSpecification: { '@type': 'UnitPriceSpecification', price, priceCurrency: 'INR', billingDuration: 'P1M', unitText: 'MONTH', valueAddedTaxIncluded: !gst } } : {}),
  });
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
    offers: [
      ...familyPlans.map((p) => offer(p.name, p.price.inr, false)),
      ...businessColumns.filter((c) => c.price).map((c) => offer(`Business ${c.name}`, c.price, true)),
    ],
    featureList: MODES.flatMap((m) => [...m.steps, ...m.features].map((f) => f.title)).filter((t, i, all) => all.indexOf(t) === i),
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
    bodyAttrs: 'data-mode="family"',
  }).replace('</body>', `${MODE_SCRIPT}\n</body>`);
}
