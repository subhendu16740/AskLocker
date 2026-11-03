# The public site: asklocker.com's landing page and films

The app is a single-page export: one `index.html` that draws every screen
with JavaScript. A search engine or an AI assistant reading asklocker.com saw
an empty page. This folder writes plain HTML pages beside the app, for them
and for anyone deciding whether to try AskLocker. **The app is untouched:**
nothing in `src/` changes, and every address but `/` is still the app's.

| Address | What | Written from |
|---|---|---|
| `/` | The landing page | `content.mjs`, `pages/landing.mjs` |
| `/videos` | Every film | `videos/*/`, `pages/films.mjs` |
| `/videos/<slug>` | One film, its chapters and transcript | `videos/<slug>/` |
| `/robots.txt`, `/sitemap.xml` | For search engines | `pages/machine.mjs` |
| `/llms.txt`, `/llms-full.txt` | For AI assistants ([llmstxt.org](https://llmstxt.org)) | `pages/machine.mjs` |
| `/privacy` | The privacy policy (unchanged) | `public/privacy.html` |

`npm run build` runs `node site/build.mjs` last, after `expo export` and the
other two steps, and it writes into `dist/`.

## How `/` becomes the landing page

- `dist/_redirects` gets one rule, `/ /landing 200`: Cloudflare Pages serves
  `landing.html` at `/` without changing the address. A `_redirects` rule is
  followed even where a file matches (Cloudflare's docs), and it applies to
  its own path only, so the single-page fallback still answers every other
  address with the app's `index.html`. `/home` and every deep link open the
  app exactly as before.
- **The landing page hands the app's own visitors on** (`APP_FORWARD` in
  `lib/html.mjs`, the first thing in `<head>`):
  1. **A sign-in coming back.** Google's redirect sign-in returns to the
     site's root (`redirectTo: window.location.origin` in
     `src/lib/auth.tsx`) with `?code=`, and Supabase's email links come back
     there too. They go on to `/home` with the query and hash whole, where
     the app exchanges the code as it did at `/`. Without this, sign-in on
     an address without Google's own button would stop on the landing page.
  2. **The installed app** (Home Screen, `display-mode: standalone`) opens
     the app: `/home` when signed in, else `/onboarding`, as `/` did.
  3. **Someone signed in on this browser** (Supabase's
     `sb-<project>-auth-token` in localStorage) who typed the address goes
     to their vault, as before. Not when they came from one of the site's
     own pages, so the logo still leads to the landing page.

  Search engines, AI assistants and a link opened from WhatsApp are none of
  these, and read the page. The QA self-test runs the script in each case.
- **Nothing else may claim `/`, `/landing`, `/videos` or `/media`.** The build
  stops if `src/app` gains a route with one of those names, and if `public/`
  holds a `robots.txt`, `sitemap.xml` or `llms*.txt` (they are written here).
- `public/manifest.json`'s `start_url` stays `/`: the forwarder sends the
  installed app on, so the app's identity on phones does not change.

## Production or not

The build reads `EXPO_PUBLIC_SUPABASE_URL`, the value that decides whose data
a build reaches, as `scripts/lab-pages.mjs` and `src/lib/environment.ts` do.

- **Production** (the PROD project): pages indexable, published films only,
  `robots.txt` open to everyone but the app's screens.
- **Anything else** (DEV, a preview, a build without `.env`): every page
  `noindex`, `robots.txt` shuts everything, and **drafts are shown**, marked
  Draft, so a film can be watched on DEV before it goes out.

## The look: the app's own

`styles.css` uses only the app's design (`src/constants/design.ts`,
`components/settings-ui.tsx`): the system font, the 17/16/15/13/12 type
scale at weights 400 to 600, navy with coral for small marks, white cards
(16 radius, a faint shadow), 32px icon boxes, 44px buttons, and the
onboarding's navy gradient at the top. Light only, like the app's screens.
Add nothing the app doesn't have: no new colours, sizes or fonts.

## Changing the words

Short, as the app's screens are: a title and one line. Where the app
already says something (the onboarding slides, Settings › Privacy), the
page uses its words.


Everything the landing page says is in `content.mjs`, as data: the page, its
FAQ structured data and `llms-full.txt` are drawn from it, so they agree.

- **Numbers are never typed in.** Prices and limits come from
  `supabase/functions/_shared/plan-text.ts` (what the payments function
  charges), the file limit from `limits.ts`, the languages from
  `src/lib/voice-languages.ts` (`lib/facts.mjs`). A price change in the app
  changes the site with the same release.
- **The app's privacy rule holds here** (CLAUDE.md, Conventions): no
  "secure", "safe", "private and isolated", "100% private", "only you can
  see it" or "nothing is kept"; "end-to-end" only as "not end-to-end"; "In
  AskLocker, only people in your vault…" is the approved limit. The QA
  self-test fails the page, `llms-full.txt` and every transcript otherwise.
- Claim only what the app does. Voice answers come in every voice language;
  typed questions carry no language, so they are not claimed.
- The share card (`media/og-card.jpg`, what WhatsApp and LinkedIn show) is
  drawn from the headline: `node site/tools/og-card.mjs` after changing it.

## Putting a film on the site

Films are made in `marketing/video/` and rendered to `marketing/video/out/`
(not committed). Each film on the site is a folder, `site/videos/<slug>/`,
whose name is its address (`/videos/<slug>`):

```
video.json      title, description, audience, uploadDate, durationSeconds,
                width, height, video, poster, chapters, order, draft
poster.jpg      the frame shown before it plays
transcript.md   what the film says and shows (needed to publish)
video.mp4       the film, unless "video" is an https:// address
captions.vtt    optional
```

`lib/videos.mjs` documents every field. One command makes the folder:

```bash
node site/tools/add-video.mjs marketing/video/out/asklocker-family-16x9.mp4 --slug asklocker-for-families --title "…" --description "…" --audience family --poster-at 76
```

It measures the film, takes the poster, moves the MP4's index to the front
so it plays while it loads, and squeezes it only if it is over 24 MB. Then:

1. **Write `transcript.md`**: what is on screen and what is said, scene by
   scene, in plain sentences, `##` for each scene. Search engines and AI
   assistants read this, not the pictures, and Google needs the film's page
   to be about the film. Add `chapters` to `video.json` (seconds and a
   title): they become Google's key moments and links on the page.
2. **Watch it on DEV.** A film is a draft until `video.json` says
   `"draft": false`. Drafts show in every build but production, so merge
   into `dev` and open `https://dev.asklocker.pages.dev/videos/<slug>`, or
   preview it here (below).
3. **Publish**: set `"draft": false` and release. The build refuses a
   published film without its video, poster or transcript, or with a TODO
   left in the transcript.

`reviewNotes` in `video.json` is for people and the marketing agent: what
must change before the film can go out. The build ignores it.

### Where the film file lives

Cloudflare Pages takes at most **25 MB a file** (the build stops above it),
and every film committed here stays in git history for good. A 16:9 cut of
a minute or two at 1080p fits; past a few films, host them elsewhere and put
the address in `"video"` (`add-video.mjs --url https://…`):

- **Cloudflare R2** (free up to 10 GB, no charge for downloads): a bucket
  with a public custom domain such as `media.asklocker.com`, the MP4
  uploaded there. Nothing else changes.
- **YouTube** helps people find the films there too: post them there as
  well. The site still plays its own MP4, so the film's page here stays its
  home for search.

## Preview

```bash
npm run site                      # site/out/, drafts shown, the landing page also as index.html
npx http-server site/out -p 4321  # then open http://localhost:4321
npm run site -- --production      # what production would publish
```

`site/out/` is not committed. A full `npm run build` writes the real `dist/`,
and `npx wrangler pages dev dist` serves it as Cloudflare Pages would,
`_redirects` and the single-page fallback included.

## After a release: tell search engines

- **Google Search Console**: verify asklocker.com if it isn't yet (Google's
  brand check for the sign-in screen needs that too, with this public home
  page), submit `https://asklocker.com/sitemap.xml`, and use URL Inspection
  on `/` once.
- **Bing Webmaster Tools** (Bing's index also feeds Copilot and other AI
  search): import the site from Search Console and submit the sitemap.
- **Cloudflare dashboard**, asklocker.com › Security › Bots, and AI Crawl
  Control: if "Block AI bots" or a managed robots.txt is on, Cloudflare
  answers AI assistants before this `robots.txt` does. Keep them off for the
  public pages, or the GEO half of this does nothing.
