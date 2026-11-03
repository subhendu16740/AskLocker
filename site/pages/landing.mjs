// asklocker.com/ : what AskLocker is, for people, search engines and AI
// assistants. Served at / by dist/_redirects (see build.mjs); the app keeps
// every other address.

import { business, closing, faq, features, hero, meta, planRows, pricingNotes, privacy, steps, what } from '../content.mjs';
import { familyPlans, facts, rupees } from '../lib/facts.mjs';
import { abs, esc, icon, linkify, orgAndSite, page } from '../lib/html.mjs';
import { filmFigure, videoObject } from './films.mjs';

function heroSection() {
  const d = hero.demo;
  return `<section class="hero">
<div class="wrap hero-grid">
<div>
<span class="eyebrow">${esc(hero.eyebrow)}</span>
<h1>${esc(hero.title.split(', ')[0])}, <em>${esc(hero.title.split(', ').slice(1).join(', '))}</em></h1>
<p class="lead">${esc(hero.lead)}</p>
<div class="hero-cta"><a class="btn btn-primary btn-lg" href="/onboarding">Get started free ${icon('arrow-right', 18)}</a><a class="btn btn-ghost btn-lg" href="/login">Sign in</a></div>
<p class="hero-note">${esc(hero.note)}</p>
</div>
<figure class="demo" aria-label="An example question and answer in AskLocker">
<div class="demo-bar">${icon('message-circle', 20)} Ask<span>All vaults</span></div>
<div class="demo-body">
<p class="bubble bubble-q">${esc(d.question)}</p>
<div class="bubble bubble-a"><p>${esc(d.answer)}</p><span class="chip">${icon('file-text', 14)} ${esc(d.source)}</span></div>
</div>
<div class="demo-voice"><span class="mic">${icon('mic', 18)}</span>${esc(d.voice)}</div>
</figure>
</div>
</section>`;
}

function whatSection() {
  return `<section class="section section-what" id="what" aria-labelledby="what-h">
<div class="wrap"><div class="what">
<h2 id="what-h">${esc(what.heading)}</h2>
${what.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n')}
</div></div>
</section>`;
}

function howSection() {
  const cards = steps.map((s, i) => `<article class="card">
<div class="step-head"><span class="icon-box">${icon(s.icon)}</span><span class="step-n">Step ${i + 1}</span></div>
<h3>${esc(s.title)}</h3>
<p>${esc(s.text)}</p>
</article>`).join('\n');
  return `<section class="section" id="how" aria-labelledby="how-h" style="padding-top:0">
<div class="wrap">
<div class="section-head"><span class="eyebrow">How it works</span><h2 id="how-h">Add it once. Ask whenever you need it.</h2></div>
<div class="grid grid-3">${cards}</div>
</div>
</section>`;
}

function featuresSection() {
  const cards = features.map((f) => `<article class="card">
<span class="icon-box">${icon(f.icon)}</span>
<h3>${esc(f.title)}</h3>
<p>${esc(f.text)}</p>
</article>`).join('\n');
  return `<section class="section" id="features" aria-labelledby="features-h" style="padding-top:0">
<div class="wrap">
<div class="section-head"><span class="eyebrow">For the whole family</span><h2 id="features-h">Made for how Indian families keep papers</h2>
<p class="section-lead">Parents, grandparents and children each have their own documents. AskLocker keeps track of whose is whose.</p></div>
<div class="grid grid-4">${cards}</div>
</div>
</section>`;
}

function filmsSection(videos) {
  if (!videos.length) return '';
  const shown = videos.slice(0, 4);
  return `<section class="section" id="films" aria-labelledby="films-h" style="padding-top:0">
<div class="wrap">
<div class="section-head"><span class="eyebrow">Films</span><h2 id="films-h">See AskLocker at work</h2>
<p class="section-lead">Short films of the app, screen by screen, with everything said in them written out on each film's page.</p></div>
<div class="films">${shown.map((v) => filmFigure(v, { headingTag: 'h3' })).join('\n')}</div>
${videos.length ? `<p class="films-more"><a href="/videos">All films and transcripts ${icon('arrow-right', 16)}</a></p>` : ''}
</div>
</section>`;
}

function businessSection() {
  return `<section class="section biz" id="business" aria-labelledby="biz-h">
<div class="wrap biz-grid">
<div>
<span class="eyebrow">${esc(business.eyebrow)}</span>
<h2 id="biz-h">${esc(business.heading)}</h2>
<p>${esc(business.text)}</p>
<p class="biz-price">${esc(business.price)}</p>
<a class="btn btn-lg" href="${esc(business.cta.href)}">${icon('briefcase', 18)} ${esc(business.cta.label)}</a>
</div>
<ul>${business.points.map((pt) => `<li>${icon('check', 20)}<span>${esc(pt)}</span></li>`).join('')}</ul>
</div>
</section>`;
}

function cell(value) {
  if (value === true) return `${icon('check', 18)}<span class="sr">Yes</span>`;
  if (value === false) return `<span class="no">${icon('minus', 18)}</span><span class="sr">No</span>`;
  return esc(value);
}

function pricingSection() {
  const cards = familyPlans.map((p) => {
    const price = p.price.inr === 0
      ? '<p class="price"><b>₹0</b></p><p class="price-alt">No card needed</p>'
      : `<p class="price"><b>${rupees(p.price.inr)}</b><span>a month</span></p><p class="price-alt">or ${rupees(p.yearly.inr)} a year</p>`;
    const rows = planRows.map((r) => `<div><dt>${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</dt><dd>${cell(r.cell(p))}</dd></div>`).join('');
    return `<article class="plan${p.id === 'plus' ? ' plan-plus' : ''}">
<h3>${esc(p.name)}</h3>
${price}
<dl>${rows}</dl>
<div class="plan-cta"><a class="btn ${p.id === 'plus' ? 'btn-primary' : 'btn-ghost'}" href="/onboarding" style="width:100%">${p.id === 'free' ? 'Start free' : 'Get started'}</a></div>
</article>`;
  }).join('\n');
  return `<section class="section" id="pricing" aria-labelledby="pricing-h">
<div class="wrap">
<div class="section-head"><span class="eyebrow">Pricing</span><h2 id="pricing-h">Free to start. Plans for bigger families.</h2>
<p class="section-lead">Start on Free. Move to a plan in the app when your family needs more people, space or questions.</p></div>
<div class="plans">${cards}</div>
<div class="notes">${pricingNotes.map((n) => `<p>${esc(n)}</p>`).join('')}</div>
</div>
</section>`;
}

function privacySection() {
  return `<section class="section" id="privacy" aria-labelledby="privacy-h" style="padding-top:0">
<div class="wrap">
<div class="section-head"><span class="eyebrow">Privacy, plainly</span><h2 id="privacy-h">${esc(privacy.heading)}</h2></div>
<div class="privacy">
<ul>${privacy.points.map((pt) => `<li>${esc(pt)}</li>`).join('')}</ul>
<p><a href="/privacy">Read the privacy policy</a>. It names every service we use.</p>
</div>
</div>
</section>`;
}

function faqSection() {
  return `<section class="section" id="faq" aria-labelledby="faq-h" style="padding-top:0">
<div class="wrap">
<div class="section-head"><span class="eyebrow">FAQ</span><h2 id="faq-h">Questions people ask</h2></div>
<div class="faq">${faq.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(f.q)}${icon('chevron-down', 20)}</summary><p>${linkify(f.a)}</p></details>`).join('\n')}</div>
</div>
</section>`;
}

function closingSection() {
  return `<section class="section" style="padding-top:0">
<div class="wrap"><div class="closing">
<h2>${esc(closing.heading)}</h2>
<p>${esc(closing.text)}</p>
<a class="btn btn-lg" href="/onboarding">Get started free ${icon('arrow-right', 18)}</a>
</div></div>
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
    description: what.paragraphs[0],
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any, in a web browser (Android, iPhone, Windows, macOS)',
    browserRequirements: 'Requires JavaScript',
    inLanguage: 'en-IN',
    image: abs('/icon-512.png'),
    publisher: { '@id': abs('/#org') },
    offers,
    featureList: [
      ...steps.map((s) => s.title),
      ...features.map((f) => f.title),
      'Business vaults for small businesses',
    ],
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
  const body = [
    heroSection(),
    whatSection(),
    howSection(),
    featuresSection(),
    filmsSection(videos),
    businessSection(),
    pricingSection(),
    privacySection(),
    faqSection(),
    closingSection(),
  ].join('\n');
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
