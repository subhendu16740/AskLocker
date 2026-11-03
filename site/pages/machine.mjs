// What crawlers and AI assistants read before, or instead of, the pages:
// robots.txt, sitemap.xml (with the films), llms.txt (a map of the site, in
// Markdown, per llmstxt.org) and llms-full.txt (the whole landing page and
// every transcript, in Markdown).

import { about, business, faq, features, hero, meta, planRows, pricingNote, privacy, steps } from '../content.mjs';
import { SITE_URL, SUPPORT_EMAIL, businessPlans, familyPlans, rupees } from '../lib/facts.mjs';
import { abs, clock } from '../lib/html.mjs';
import { transcriptText } from './films.mjs';

/**
 * robots.txt. Production: everything public may be read, by search engines
 * and AI assistants alike, and the app's own screens are left out (they are
 * one empty page until someone signs in). Any other build: nothing, since
 * DEV and previews repeat asklocker.com's pages.
 *
 * Prefix rules: "Disallow: /s" (the share page) would also cover
 * /sitemap.xml, so each public file a rule's prefix covers gets an Allow,
 * which wins as the longer match (RFC 9309).
 */
export function robotsTxt({ production, appRoutes, publicPaths }) {
  if (!production) {
    return `# Not asklocker.com: a DEV or preview build of it. Nothing here is for search.\nUser-agent: *\nDisallow: /\n`;
  }
  const disallow = [...appRoutes].sort().map((r) => `/${r}`);
  const allow = publicPaths.filter((p) => disallow.some((d) => p.startsWith(d)));
  return [
    '# asklocker.com. Written by site/build.mjs: edit it there, not in dist/.',
    '# The public pages are for everyone: search engines and AI assistants are welcome.',
    '# The app\'s screens are left out: they show nothing until someone signs in.',
    'User-agent: *',
    'Content-Signal: search=yes, ai-input=yes',
    ...allow.map((p) => `Allow: ${p}`),
    ...disallow.map((d) => `Disallow: ${d}`),
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sitemapXml({ videos }) {
  const published = videos.filter((v) => !v.draft);
  const urls = [
    `<url><loc>${abs('/')}</loc></url>`,
    `<url><loc>${abs('/privacy')}</loc></url>`,
  ];
  if (published.length) urls.push(`<url><loc>${abs('/videos')}</loc><lastmod>${published.map((v) => v.uploadDate).sort().at(-1)}</lastmod></url>`);
  for (const v of published) {
    urls.push(`<url><loc>${abs(`/videos/${v.slug}`)}</loc><lastmod>${v.uploadDate}</lastmod><video:video>`
      + `<video:thumbnail_loc>${xml(abs(v.posterUrl))}</video:thumbnail_loc>`
      + `<video:title>${xml(v.title)}</video:title>`
      + `<video:description>${xml(v.description)}</video:description>`
      + `<video:content_loc>${xml(abs(v.videoUrl))}</video:content_loc>`
      + `<video:duration>${Math.round(v.durationSeconds)}</video:duration>`
      + `<video:publication_date>${v.uploadDate}</video:publication_date>`
      + '</video:video></url>');
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls.join('\n')}
</urlset>
`;
}

/** llms.txt: what AskLocker is, in a paragraph, and where to read more. */
export function llmsTxt({ videos }) {
  const published = videos.filter((v) => !v.draft);
  return [
    '# AskLocker',
    '',
    `> ${about}`,
    '',
    `- Website and app: ${SITE_URL} (works in the browser on any phone or computer; no store apps yet)`,
    `- Price: free to start. Family Plus ${rupees(familyPlans[1].price.inr)} a month, Family Pro ${rupees(familyPlans[2].price.inr)} a month; business plans from ${rupees(businessPlans[0].price)} a month + GST`,
    `- Contact: ${SUPPORT_EMAIL}`,
    '',
    '## Pages',
    '',
    `- [AskLocker](${abs('/')}): what it does, how it works, plans and prices, privacy, FAQ`,
    `- [Privacy policy](${abs('/privacy')}): what is kept, who can open documents, every service used`,
    ...(published.length ? [`- [Films](${abs('/videos')}): short films of the app, each with a transcript`] : []),
    '',
    ...(published.length ? [
      '## Films',
      '',
      ...published.map((v) => `- [${v.title}](${abs(`/videos/${v.slug}`)}): ${v.description} (${clock(v.durationSeconds)})`),
      '',
    ] : []),
    '## Optional',
    '',
    `- [Everything on the site as Markdown](${abs('/llms-full.txt')}): the landing page, FAQ and film transcripts in one file`,
    '',
  ].join('\n');
}

/** llms-full.txt: the landing page, and every film's transcript, as Markdown. */
export function llmsFullTxt({ videos }) {
  const published = videos.filter((v) => !v.draft);
  const yesNo = (value) => (value === true ? 'Yes' : value === false ? 'No' : String(value));
  const table = [
    `| | ${familyPlans.map((p) => p.name).join(' | ')} |`,
    `|---|${familyPlans.map(() => '---').join('|')}|`,
    `| Price | ${familyPlans.map((p) => (p.price.inr ? `${rupees(p.price.inr)} a month or ${rupees(p.yearly.inr)} a year` : 'Free')).join(' | ')} |`,
    ...planRows.map((r) => `| ${r.label} | ${familyPlans.map((p) => yesNo(r.cell(p))).join(' | ')} |`),
  ];
  const bizTable = [
    '| Business plan | People | Space | Questions a month | Price |',
    '|---|---|---|---|---|',
    ...businessPlans.map((b) => `| ${b.name} | ${b.members} | ${b.storage / 1024 ** 3} GB | ${b.questions.toLocaleString('en-IN')} shared | ${rupees(b.price)} a month + GST |`),
  ];
  const parts = [
    `# ${meta.title}`,
    '',
    `Source: ${abs('/')}`,
    '',
    `> ${hero.title} ${hero.lead}`,
    '',
    '## What is AskLocker?',
    '',
    about,
    '',
    '## How it works',
    '',
    ...steps.map((s, i) => `${i + 1}. **${s.title}.** ${s.text}`),
    '',
    '## Features',
    '',
    ...features.map((f) => `- **${f.title}.** ${f.text}`),
    '',
    `## ${business.title}`,
    '',
    business.text,
    '',
    ...bizTable,
    '',
    '## Plans and prices',
    '',
    ...table,
    '',
    pricingNote,
    '',
    '## Privacy',
    '',
    ...privacy.map((r) => `- **${r.title}.** ${r.text}`),
    '',
    `Privacy policy: ${abs('/privacy')}`,
    '',
    '## Frequently asked questions',
    '',
    ...faq.flatMap((f) => [`### ${f.q}`, '', f.a, '']),
  ];
  if (published.length) {
    parts.push('## Films', '');
    for (const v of published) {
      parts.push(`### ${v.title}`, '', `${v.description}`, '', `Watch: ${abs(`/videos/${v.slug}`)} (${clock(v.durationSeconds)})`, '');
      if (v.chapters.length) parts.push(...v.chapters.map((c) => `- ${clock(c.start)} ${c.title}`), '');
      if (v.transcript) parts.push('Transcript:', '', transcriptText(v.transcript), '');
    }
  }
  return `${parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
