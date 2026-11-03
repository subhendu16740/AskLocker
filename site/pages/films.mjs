// The films: a card for the landing page, /videos (all of them), and a page
// per film at /videos/<slug>. Google shows a video in search only from a
// page where the video is the main thing on it, so each film gets its own
// page, with its transcript in the HTML for search engines and AI
// assistants, and VideoObject structured data with its chapters as key
// moments.

import { abs, clock, esc, icon, isoDuration, orgAndSite, page } from '../lib/html.mjs';
import { transcriptHtml } from '../lib/videos.mjs';

const AUDIENCE_LABEL = { family: 'For families', business: 'For business', everyone: null };

function audienceBadge(v) {
  const label = AUDIENCE_LABEL[v.audience];
  return label ? `<span class="badge badge-${v.audience}">${label}</span>` : '';
}

/** The player itself, or the poster with a note while a draft has no file. */
function player(v, { eager = false } = {}) {
  if (!v.videoUrl) {
    return `<div class="film-missing" style="background-image:url('${esc(v.posterUrl)}');aspect-ratio:${v.width} / ${v.height}"><span>Film not added yet</span></div>`;
  }
  const captions = v.captionsUrl ? `<track kind="captions" src="${esc(v.captionsUrl)}" srclang="en" label="English">` : '';
  return `<video controls playsinline preload="${eager ? 'metadata' : 'none'}" poster="${esc(v.posterUrl)}" width="${v.width}" height="${v.height}" aria-label="${esc(v.title)}"><source src="${esc(v.videoUrl)}" type="${v.videoType}">${captions}<a href="${esc(v.videoUrl)}">Download the film</a></video>`;
}

export function filmFigure(v, { headingTag = 'h3' } = {}) {
  return `<figure class="film${v.portrait ? ' film-portrait' : ''}">
${player(v)}
<figcaption>
<${headingTag}><a href="/videos/${v.slug}">${esc(v.title)}</a></${headingTag}>
<div class="film-meta">${v.draft ? '<span class="badge badge-draft">Draft</span>' : ''}${audienceBadge(v)}<span>${clock(v.durationSeconds)}</span><a href="/videos/${v.slug}">Transcript</a></div>
</figcaption>
</figure>`;
}

/** transcript.md as plain text, for VideoObject.transcript and llms-full.txt. */
export function transcriptText(markdown) {
  return markdown
    .split('\n')
    .map((l) => l.replace(/^#{1,3}\s+/, '').replace(/^[-*]\s+/, '• ').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function videoObject(v) {
  const url = abs(`/videos/${v.slug}`);
  const node = {
    '@type': 'VideoObject',
    '@id': `${url}#video`,
    name: v.title,
    description: v.description,
    url,
    thumbnailUrl: [abs(v.posterUrl)],
    uploadDate: v.uploadDate,
    duration: isoDuration(v.durationSeconds),
    inLanguage: 'en-IN',
    isFamilyFriendly: true,
    publisher: { '@id': abs('/#org') },
    about: { '@id': abs('/#app') },
  };
  if (v.videoUrl) node.contentUrl = abs(v.videoUrl);
  if (v.transcript) node.transcript = transcriptText(v.transcript);
  if (v.chapters.length) {
    node.hasPart = v.chapters.map((c, i) => ({
      '@type': 'Clip',
      name: c.title,
      startOffset: Math.round(c.start),
      endOffset: Math.round(v.chapters[i + 1]?.start ?? v.durationSeconds),
      url: `${url}?t=${Math.round(c.start)}`,
    }));
  }
  return node;
}

// On a film's page only: ?t=SECONDS starts the film there (the chapters'
// links, and Google's key moments), and a chapter link seeks without
// reloading. The page reads fine without it.
const SEEK = `<script>(function(){var v=document.querySelector('.watch video');if(!v)return;
function go(t,play){v.preload='metadata';var s=function(){v.currentTime=t;if(play)v.play().catch(function(){})};if(v.readyState>0)s();else v.addEventListener('loadedmetadata',s,{once:true});if(v.readyState===0)v.load()}
var t=+new URLSearchParams(location.search).get('t');if(t>0)go(t,false);
document.querySelectorAll('a[data-t]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();go(+a.dataset.t,true);history.replaceState(null,'',a.href);v.scrollIntoView({block:'center',behavior:'smooth'})})});})();</script>`;

export function watchPage(v, { videos, indexable }) {
  const url = `/videos/${v.slug}`;
  const others = videos.filter((o) => o.slug !== v.slug).slice(0, 3);
  const chapters = v.chapters.length
    ? `<section class="card"><h2 class="heading">Chapters</h2><ol class="chapters">${v.chapters.map((c) => `<li><time datetime="${isoDuration(c.start)}">${clock(c.start)}</time><a href="${url}?t=${Math.round(c.start)}" data-t="${Math.round(c.start)}">${esc(c.title)}</a></li>`).join('')}</ol></section>`
    : '';
  const more = others.length
    ? `<section class="card"><h2 class="heading">More films</h2><ul class="chapters">${others.map((o) => `<li><time>${clock(o.durationSeconds)}</time><a href="/videos/${o.slug}">${esc(o.title)}</a></li>`).join('')}</ul></section>`
    : '';
  const body = `<div class="wrap watch">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">AskLocker</a> › <a href="/videos">Films</a> › ${esc(v.title)}</nav>
${v.draft ? '<p class="draft-note">Draft: shown on DEV only.</p>' : ''}
<h1>${esc(v.title)}</h1>
<p class="lead">${esc(v.description)}</p>
<figure class="film${v.portrait ? ' film-portrait' : ''}">${player(v, { eager: true })}
<figcaption><div class="film-meta" style="margin-top:0">${audienceBadge(v)}<span>${clock(v.durationSeconds)}</span><span>Added <time datetime="${v.uploadDate}">${formatDate(v.uploadDate)}</time></span>${v.videoUrl ? `<a href="${esc(v.videoUrl)}" download>Download</a>` : ''}</div></figcaption>
</figure>
<div class="watch-grid">
<section class="card transcript" aria-labelledby="transcript-h">
<h2 id="transcript-h">Transcript</h2>
${v.transcript ? transcriptHtml(v.transcript, esc) : '<p>No transcript yet.</p>'}
</section>
<aside class="aside">
${chapters}
${more}
<section class="card"><h2 class="heading">Try AskLocker</h2><p class="caption">Free to start.</p><p style="margin-top:12px"><a class="btn btn-primary btn-block" href="/onboarding">Get started</a></p></section>
</aside>
</div>
</div>`;
  const graph = [
    ...orgAndSite(),
    {
      '@type': 'WebPage',
      '@id': `${abs(url)}#webpage`,
      url: abs(url),
      name: v.title,
      description: v.description,
      isPartOf: { '@id': abs('/#website') },
      mainEntity: { '@id': `${abs(url)}#video` },
      inLanguage: 'en-IN',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'AskLocker', item: abs('/') },
          { '@type': 'ListItem', position: 2, name: 'Films', item: abs('/videos') },
          { '@type': 'ListItem', position: 3, name: v.title, item: abs(url) },
        ],
      },
    },
    videoObject(v),
  ];
  const ogExtra = [['og:video:width', String(v.width)], ['og:video:height', String(v.height)]];
  if (v.videoUrl) ogExtra.unshift(['og:video', abs(v.videoUrl)], ['og:video:secure_url', abs(v.videoUrl)], ['og:video:type', v.videoType]);
  return page({
    path: url,
    title: `${v.title} · AskLocker`,
    description: v.description,
    body,
    jsonLdGraph: graph,
    og: { type: 'video.other', title: v.title, image: abs(v.posterUrl), imageAlt: v.title, extra: ogExtra },
    indexable: indexable && !v.draft,
    hasFilms: true,
    headExtra: '',
  }).replace('</body>', `${SEEK}\n</body>`);
}

export function filmsIndexPage({ videos, indexable }) {
  const published = videos.filter((v) => !v.draft);
  const body = `<div class="wrap watch">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">AskLocker</a> › Films</nav>
<h1>Films</h1>
<div class="films" style="margin-top:16px">${videos.map((v) => filmFigure(v, { headingTag: 'h2' })).join('\n')}</div>
</div>`;
  const graph = [
    ...orgAndSite(),
    {
      '@type': 'CollectionPage',
      '@id': `${abs('/videos')}#webpage`,
      url: abs('/videos'),
      name: 'AskLocker films',
      isPartOf: { '@id': abs('/#website') },
      inLanguage: 'en-IN',
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: published.map((v, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`/videos/${v.slug}`), name: v.title })),
      },
    },
  ];
  return page({
    path: '/videos',
    title: 'Films · AskLocker',
    description: 'Short films of AskLocker at work: a family vault, questions answered from documents, voice in Indian languages, and business vaults.',
    body,
    jsonLdGraph: graph,
    indexable: indexable && published.length > 0,
    hasFilms: true,
  });
}

function formatDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d} ${months[m - 1]} ${y}`;
}
