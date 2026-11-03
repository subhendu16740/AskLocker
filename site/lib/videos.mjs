// The films on the site: one folder each under site/videos/<slug>/.
//
//   video.json      what the film is (fields below)
//   poster.jpg      the still shown before it plays (required)
//   transcript.md   what is said and shown, as text (required to publish):
//                   search engines and AI assistants read this, not pixels
//   video.mp4       the film, unless video.json names an https address
//   captions.vtt    optional captions
//
// video.json:
//   title           required, the film's name
//   description     required, one or two sentences
//   audience        "family", "business" or "everyone"
//   uploadDate      required, YYYY-MM-DD: when it went on the site
//   durationSeconds required
//   width, height   required, the film's pixels (1920 × 1080, 1080 × 1920)
//   video           "video.mp4" in the folder, or an https:// address
//   poster          default "poster.jpg"
//   captions        optional, a .vtt in the folder
//   chapters        optional, [{ "start": seconds, "title": "…" }]
//   draft           true until someone has watched it and said it can go
//                   out. Missing means true: nothing is published by accident.
//   order           optional; lower first, else newest first
//
// A draft is built only where the build is not production (DEV, a local
// build), marked Draft and never indexed. A published film must be complete,
// or the build stops: an empty player on asklocker.com is worse than none.
//
// Tools: site/tools/add-video.mjs makes a folder from a rendered film.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const VIDEOS_DIR = new URL('../videos/', import.meta.url);
/** Cloudflare Pages refuses a file over 25 MiB. */
export const MAX_SITE_FILE_BYTES = 25 * 1024 * 1024;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const AUDIENCES = new Set(['family', 'business', 'everyone']);

function fail(slug, message) {
  return `site/videos/${slug}: ${message}`;
}

/**
 * Every film, checked. Returns { videos, errors, warnings }: `videos` are the
 * ones this build shows (published, plus drafts when `showDrafts`), each with
 * its local files resolved.
 */
export function loadVideos({ showDrafts }) {
  const root = VIDEOS_DIR.pathname;
  const errors = [];
  const warnings = [];
  const videos = [];
  if (!existsSync(root)) return { videos, errors, warnings };

  for (const slug of readdirSync(root).sort()) {
    const dir = join(root, slug);
    if (!statSync(dir).isDirectory()) continue;
    if (!SLUG.test(slug)) {
      errors.push(fail(slug, 'the folder name is the address: lower-case letters, digits and single hyphens only'));
      continue;
    }
    const metaPath = join(dir, 'video.json');
    if (!existsSync(metaPath)) {
      errors.push(fail(slug, 'no video.json'));
      continue;
    }
    let meta;
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    } catch (err) {
      errors.push(fail(slug, `video.json is not valid JSON (${err.message})`));
      continue;
    }

    const draft = meta.draft !== false;
    if (draft && !showDrafts) continue;

    const problems = [];
    const need = (ok, message) => { if (!ok) problems.push(message); };
    need(typeof meta.title === 'string' && meta.title.trim().length > 0, 'title is missing');
    need(typeof meta.title !== 'string' || meta.title.length <= 100, 'title is over 100 characters');
    need(typeof meta.description === 'string' && meta.description.trim().length > 0, 'description is missing');
    need(typeof meta.description !== 'string' || meta.description.length <= 400, 'description is over 400 characters');
    need(AUDIENCES.has(meta.audience ?? 'everyone'), 'audience must be "family", "business" or "everyone"');
    need(typeof meta.uploadDate === 'string' && DATE.test(meta.uploadDate), 'uploadDate must be YYYY-MM-DD');
    need(Number.isFinite(meta.durationSeconds) && meta.durationSeconds > 0, 'durationSeconds must be a number of seconds');
    need(Number.isInteger(meta.width) && Number.isInteger(meta.height) && meta.width > 0 && meta.height > 0, 'width and height must be whole numbers of pixels');
    if (meta.chapters !== undefined) {
      need(Array.isArray(meta.chapters) && meta.chapters.every((c) => Number.isFinite(c.start) && typeof c.title === 'string' && c.title.trim()), 'chapters must be [{ "start": seconds, "title": "…" }]');
    }

    // Files in the folder are copied to /media/videos/<slug>/ with the site.
    const files = [];
    const local = (name, what) => {
      if (typeof name !== 'string' || !name || name.includes('/') || name.startsWith('.')) {
        problems.push(`${what} must be a file name in the folder`);
        return null;
      }
      const path = join(dir, name);
      if (!existsSync(path)) {
        problems.push(`${what} "${name}" is not in the folder`);
        return null;
      }
      const bytes = statSync(path).size;
      if (bytes > MAX_SITE_FILE_BYTES) {
        problems.push(`${what} "${name}" is ${(bytes / 1048576).toFixed(1)} MB; Cloudflare Pages takes at most 25 MB a file. Host it elsewhere (an https address in "video") or compress it (site/tools/add-video.mjs does both).`);
        return null;
      }
      files.push({ name, path, bytes });
      return `/media/videos/${slug}/${name}`;
    };

    const posterUrl = local(meta.poster ?? 'poster.jpg', 'poster');

    let videoUrl = null;
    let videoType = 'video/mp4';
    if (typeof meta.video === 'string' && /^https:\/\//.test(meta.video)) {
      videoUrl = meta.video;
    } else if (typeof meta.video === 'string' && /^http:/.test(meta.video)) {
      problems.push('video must be an https:// address');
    } else if (meta.video !== undefined || existsSync(join(dir, 'video.mp4'))) {
      videoUrl = local(meta.video ?? 'video.mp4', 'video');
    }
    if (videoUrl && /\.webm(\?|$)/i.test(videoUrl)) videoType = 'video/webm';
    const captionsUrl = meta.captions ? local(meta.captions, 'captions') : null;

    const transcriptPath = join(dir, 'transcript.md');
    const transcript = existsSync(transcriptPath) ? readFileSync(transcriptPath, 'utf8').trim() : '';

    if (!draft) {
      need(videoUrl, 'a published film needs its video: video.mp4 in the folder or an https:// address in "video"');
      need(transcript.length > 0, 'a published film needs transcript.md: it is what search engines and AI assistants read');
      need(!/\bTODO\b/.test(transcript), 'transcript.md still has a TODO in it');
    } else if (!videoUrl) {
      warnings.push(fail(slug, 'draft without its video yet: shown as a poster only'));
    }

    if (problems.length) {
      // A draft with problems is left out with a warning; a published film stops the build.
      (draft ? warnings : errors).push(...problems.map((m) => fail(slug, m)));
      continue;
    }

    videos.push({
      slug,
      draft,
      title: meta.title.trim(),
      description: meta.description.trim(),
      audience: meta.audience ?? 'everyone',
      uploadDate: meta.uploadDate,
      durationSeconds: meta.durationSeconds,
      width: meta.width,
      height: meta.height,
      portrait: meta.height > meta.width,
      videoUrl,
      videoType,
      posterUrl,
      captionsUrl,
      chapters: (meta.chapters ?? []).slice().sort((a, b) => a.start - b.start),
      transcript,
      order: Number.isFinite(meta.order) ? meta.order : null,
      files,
    });
  }

  videos.sort((a, b) => {
    if (a.order !== null || b.order !== null) return (a.order ?? Infinity) - (b.order ?? Infinity);
    return b.uploadDate.localeCompare(a.uploadDate);
  });
  return { videos, errors, warnings };
}

/**
 * transcript.md to HTML: headings (#, ##, ###), "- " lists and paragraphs.
 * Everything else is text. `esc` is html.mjs's.
 */
export function transcriptHtml(markdown, esc) {
  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '), esc)}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<ul>${list.map((li) => `<li>${inline(li, esc)}</li>`).join('')}</ul>`); list = null; } };
  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara(); flushList();
      // The page's h1 is the film's title, so transcript headings start at h2.
      const level = Math.min(heading[1].length + 1, 3);
      out.push(`<h${level}>${inline(heading[2], esc)}</h${level}>`);
    } else if (/^[-*]\s+/.test(line)) {
      flushPara();
      (list ??= []).push(line.replace(/^[-*]\s+/, ''));
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return out.join('\n');
}

/** **bold** and *emphasis*, nothing else. */
function inline(text, esc) {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
