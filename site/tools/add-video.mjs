// Puts a rendered film on the site, as a draft: one command for a person or
// the marketing agent, after marketing/video renders it.
//
//   node site/tools/add-video.mjs marketing/video/out/asklocker-family-16x9.mp4 \
//     --slug family-film --title "…" --description "…" --audience family
//
// It makes (or updates) site/videos/<slug>/:
//   poster.jpg     a frame of the film (--poster-at SECONDS, default a tenth in)
//   video.mp4      the film, its index moved to the front so it starts
//                  playing before it has all arrived (+faststart, no
//                  quality lost), and squeezed only if it is over 24 MB,
//                  since Cloudflare Pages takes 25 MB a file at most
//   video.json     its length and size measured from the file; a draft
//   transcript.md  a stub to fill in, if there is none
//
// Hosting the film elsewhere (R2, a CDN): --url https://… keeps the file out
// of the repository and writes that address instead of video.mp4.
//
// Then: write transcript.md, watch it on DEV, and set "draft": false in
// video.json to publish it with the next release. See site/README.md.
//
// Options: --audience family|business|everyone  --date YYYY-MM-DD
//          --poster-at SECONDS  --url https://…  --order N
// Needs ffmpeg and ffprobe ($FFMPEG and $FFPROBE override).

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || 'ffprobe';
const LIMIT = 24 * 1024 * 1024;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function usage(message) {
  if (message) console.error(`[add-video] ${message}`);
  console.error('Usage: node site/tools/add-video.mjs <film.mp4> --slug <slug> --title "…" --description "…" [--audience family|business|everyone] [--date YYYY-MM-DD] [--poster-at SECONDS] [--url https://…] [--order N]');
  process.exit(1);
}

const argv = process.argv.slice(2);
const opts = {};
const files = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opts[argv[i].slice(2)] = argv[++i];
  else files.push(argv[i]);
}
const [input] = files;
if (!input || !existsSync(input)) usage(input ? `No file at ${input}` : 'Which film?');
if (!opts.slug || !SLUG.test(opts.slug)) usage('--slug is the film\'s address: lower-case letters, digits and single hyphens');
if (opts.url && !/^https:\/\//.test(opts.url)) usage('--url must be an https:// address');
if (opts.audience && !['family', 'business', 'everyone'].includes(opts.audience)) usage('--audience is family, business or everyone');

const dir = fileURLToPath(new URL(`../videos/${opts.slug}/`, import.meta.url));
const metaPath = join(dir, 'video.json');
const before = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
if (!before.title && !opts.title) usage('--title is needed for a new film');
if (!before.description && !opts.description) usage('--description is needed for a new film');

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

const probe = JSON.parse(run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input]));
const videoStream = probe.streams.find((s) => s.codec_type === 'video');
const audioStream = probe.streams.find((s) => s.codec_type === 'audio');
if (!videoStream) usage(`${input} has no video stream`);
const duration = Math.round(Number(probe.format.duration) * 100) / 100;
const width = videoStream.width;
const height = videoStream.height;

mkdirSync(dir, { recursive: true });

// The poster: a frame, 1280 on its long side, as a JPEG.
const posterAt = opts['poster-at'] !== undefined ? Number(opts['poster-at']) : Math.round(duration / 10);
const scale = width >= height ? 'scale=1280:-2' : 'scale=-2:1280';
run(FFMPEG, ['-y', '-v', 'error', '-ss', String(posterAt), '-i', input, '-frames:v', '1', '-vf', scale, '-q:v', '3', join(dir, 'poster.jpg')]);

let videoField = opts.url;
if (!opts.url) {
  const target = join(dir, 'video.mp4');
  const tmp = join(dir, 'video.tmp.mp4');
  const plain = videoStream.codec_name === 'h264' && (!audioStream || audioStream.codec_name === 'aac');
  if (plain) {
    run(FFMPEG, ['-y', '-v', 'error', '-i', input, '-c', 'copy', '-movflags', '+faststart', tmp]);
  } else {
    copyFileSync(input, tmp);
  }
  // Over the limit, or not H.264 and AAC: encode, a little harder each time.
  let crf = 23;
  while (!plain || statSync(tmp).size > LIMIT) {
    if (crf > 32) {
      rmSync(tmp, { force: true });
      usage(`Still over 24 MB at CRF 32. Host it elsewhere and pass --url, or render a shorter cut.`);
    }
    const encoded = join(dir, 'video.enc.mp4');
    const fit = width >= height ? "scale='min(1920,iw)':-2" : "scale=-2:'min(1920,ih)'";
    run(FFMPEG, ['-y', '-v', 'error', '-i', input, '-vf', fit, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', encoded]);
    renameSync(encoded, tmp);
    console.log(`[add-video] Encoded at CRF ${crf}: ${(statSync(tmp).size / 1048576).toFixed(1)} MB`);
    crf += 3;
    if (!plain && statSync(tmp).size <= LIMIT) break;
  }
  renameSync(tmp, target);
  videoField = 'video.mp4';
  console.log(`[add-video] video.mp4: ${(statSync(target).size / 1048576).toFixed(1)} MB, ${width} × ${height}, ${duration} s`);
} else if (existsSync(join(dir, 'video.mp4'))) {
  rmSync(join(dir, 'video.mp4'));
}

const meta = {
  title: opts.title ?? before.title,
  description: opts.description ?? before.description,
  audience: opts.audience ?? before.audience ?? 'everyone',
  uploadDate: opts.date ?? before.uploadDate ?? new Date().toISOString().slice(0, 10),
  durationSeconds: duration,
  width,
  height,
  video: videoField,
  poster: 'poster.jpg',
  ...(before.captions ? { captions: before.captions } : {}),
  ...(before.chapters ? { chapters: before.chapters } : {}),
  ...(opts.order !== undefined ? { order: Number(opts.order) } : before.order !== undefined ? { order: before.order } : {}),
  ...(before.reviewNotes ? { reviewNotes: before.reviewNotes } : {}),
  // A new or replaced film is a draft until someone watches it on DEV.
  draft: true,
};
writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

const transcriptPath = join(dir, 'transcript.md');
if (!existsSync(transcriptPath)) {
  writeFileSync(transcriptPath, `TODO: write what the film says and shows, scene by scene, in plain sentences.
Search engines and AI assistants read this, not the pictures, and the site will not publish the film until the TODO is gone.

## First scene

What is on screen, and any words said or shown.
`);
}

console.log(`[add-video] site/videos/${opts.slug}/ is ready, as a draft.`);
console.log('  1. Write transcript.md (and chapters in video.json, if you like).');
console.log('  2. Build (node site/build.mjs --preview) or merge into dev, and watch it there.');
console.log('  3. Set "draft": false in video.json; it goes out with the next release.');
