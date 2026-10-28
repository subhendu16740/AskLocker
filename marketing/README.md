# Marketing

Go-to-market material for AskLocker. Nothing here is part of the app build:
Metro only bundles from `src/app`, and none of these files are TypeScript.

- `family/` and `business/`: the finished films, feature shorts and posters,
  ready to post (below).
- `video/`: the code that makes them: both films and every feature's short and
  poster, in 16:9, 9:16 and 1:1. See [`video/README.md`](video/README.md) to
  render them.
- `strategy/index.html`: the go-to-market strategy, written for engineers
  (problem as an incident report, customer as a type, funnel as a pipeline with
  named events, a 90-day plan with exit gates, and a table of the product claims
  the code supports today). Open it in a browser; the film plays once the rendered
  files sit in `strategy/media/`, which is not committed.

`video/out/`, where everything is rendered, is gitignored; `video/tools/publish.sh`
copies the finished files into `family/` and `business/`, which are committed.
All of it shows a fictional family and business and SPECIMEN papers, so it can
be shared publicly.

## What's where

| Folder | What | Shapes |
|---|---|---|
| `family/films/` | The family film: a night when a policy number can't be found, then the same night with AskLocker | 2:15 in [16:9](./family/films/asklocker-family-16x9.mp4) and [9:16](./family/films/asklocker-family-9x16.mp4); 1:11 in [16:9](./family/films/asklocker-family-16x9-short.mp4) and [9:16](./family/films/asklocker-family-9x16-short.mp4) |
| `business/films/` | The business film: a formal product film for shops, clinics and CAs | 1:31 in [16:9](./business/films/asklocker-business-16x9.mp4) and [9:16](./business/films/asklocker-business-9x16.mp4); 0:59 in [16:9](./business/films/asklocker-business-16x9-short.mp4) and [9:16](./business/films/asklocker-business-9x16-short.mp4) |
| `family/shorts/`, `business/shorts/` | One feature each: why it exists, the app doing it, the end card | 9:16, 14 to 21 seconds, with music, and `-sfx-only` without it |
| `family/posters/`, `business/posters/` | One feature each: its line, and the phone showing it | 1:1 (`1080x1080`) and 16:9 (`1920x1080`) |

Where each fits: 16:9 films for the website, YouTube, LinkedIn and pitches;
9:16 films and shorts for Reels, YouTube Shorts and WhatsApp Status (the
`-sfx-only` shorts keep the taps and voices, for adding a platform's own
music); 1:1 posters for Instagram and WhatsApp; 16:9 posters for LinkedIn, X
and slides.

## For families

| | | |
|---|---|---|
| <img src="family/posters/asklocker-family-ask-1080x1080.png" width="260" alt="Ask your documents anything."><br>**Ask**<br>[Short](./family/shorts/asklocker-family-ask-9x16.mp4) · [no music](./family/shorts/asklocker-family-ask-9x16-sfx-only.mp4) · [1:1](./family/posters/asklocker-family-ask-1080x1080.png) · [16:9](./family/posters/asklocker-family-ask-1920x1080.png) | <img src="family/posters/asklocker-family-read-1080x1080.png" width="260" alt="Snap a page. Know what it says."><br>**Instant insights**<br>[Short](./family/shorts/asklocker-family-read-9x16.mp4) · [no music](./family/shorts/asklocker-family-read-9x16-sfx-only.mp4) · [1:1](./family/posters/asklocker-family-read-1080x1080.png) · [16:9](./family/posters/asklocker-family-read-1920x1080.png) | <img src="family/posters/asklocker-family-voice-1080x1080.png" width="260" alt="Ask out loud. Hear the answer."><br>**Voice**<br>[Short](./family/shorts/asklocker-family-voice-9x16.mp4) · [no music](./family/shorts/asklocker-family-voice-9x16-sfx-only.mp4) · [1:1](./family/posters/asklocker-family-voice-1080x1080.png) · [16:9](./family/posters/asklocker-family-voice-1920x1080.png) |
| <img src="family/posters/asklocker-family-reminders-1080x1080.png" width="260" alt="Renew it before it runs out."><br>**Reminders ★**<br>[Short](./family/shorts/asklocker-family-reminders-9x16.mp4) · [no music](./family/shorts/asklocker-family-reminders-9x16-sfx-only.mp4) · [1:1](./family/posters/asklocker-family-reminders-1080x1080.png) · [16:9](./family/posters/asklocker-family-reminders-1920x1080.png) | <img src="family/posters/asklocker-family-tree-1080x1080.png" width="260" alt="It knows who “Dadi” is."><br>**Family tree**<br>[Short](./family/shorts/asklocker-family-tree-9x16.mp4) · [no music](./family/shorts/asklocker-family-tree-9x16-sfx-only.mp4) · [1:1](./family/posters/asklocker-family-tree-1080x1080.png) · [16:9](./family/posters/asklocker-family-tree-1920x1080.png) | <img src="family/posters/asklocker-family-emergency-1080x1080.png" width="260" alt="What the doctor asks, one tap away."><br>**Emergency card**<br>[Short](./family/shorts/asklocker-family-emergency-9x16.mp4) · [no music](./family/shorts/asklocker-family-emergency-9x16-sfx-only.mp4) · [1:1](./family/posters/asklocker-family-emergency-1080x1080.png) · [16:9](./family/posters/asklocker-family-emergency-1920x1080.png) |
| <img src="family/posters/asklocker-family-share-1080x1080.png" width="260" alt="Send one document. Not your whole vault."><br>**Share by link**<br>[Short](./family/shorts/asklocker-family-share-9x16.mp4) · [no music](./family/shorts/asklocker-family-share-9x16-sfx-only.mp4) · [1:1](./family/posters/asklocker-family-share-1080x1080.png) · [16:9](./family/posters/asklocker-family-share-1920x1080.png) | <img src="family/posters/asklocker-family-vaults-1080x1080.png" width="260" alt="Your papers, sent and stored encrypted."><br>**Privacy**<br>[Short](./family/shorts/asklocker-family-vaults-9x16.mp4) · [no music](./family/shorts/asklocker-family-vaults-9x16-sfx-only.mp4) · [1:1](./family/posters/asklocker-family-vaults-1080x1080.png) · [16:9](./family/posters/asklocker-family-vaults-1920x1080.png) | <img src="family/posters/asklocker-family-fingerprint-1080x1080.png" width="260" alt="Open it with a touch."><br>**Fingerprint sign-in**<br>[Short](./family/shorts/asklocker-family-fingerprint-9x16.mp4) · [no music](./family/shorts/asklocker-family-fingerprint-9x16-sfx-only.mp4) · [1:1](./family/posters/asklocker-family-fingerprint-1080x1080.png) · [16:9](./family/posters/asklocker-family-fingerprint-1920x1080.png) |

★ Reminders need Family Plus; on Free, one reminder 30 days before.

## For business

| | | |
|---|---|---|
| <img src="business/posters/asklocker-business-capture-1080x1080.png" width="260" alt="Snap a bill. Know what it says."><br>**Capture**<br>[Short](./business/shorts/asklocker-business-capture-9x16.mp4) · [no music](./business/shorts/asklocker-business-capture-9x16-sfx-only.mp4) · [1:1](./business/posters/asklocker-business-capture-1080x1080.png) · [16:9](./business/posters/asklocker-business-capture-1920x1080.png) | <img src="business/posters/asklocker-business-ask-1080x1080.png" width="260" alt="Ask your records anything."><br>**Ask**<br>[Short](./business/shorts/asklocker-business-ask-9x16.mp4) · [no music](./business/shorts/asklocker-business-ask-9x16-sfx-only.mp4) · [1:1](./business/posters/asklocker-business-ask-1080x1080.png) · [16:9](./business/posters/asklocker-business-ask-1920x1080.png) | <img src="business/posters/asklocker-business-overview-1080x1080.png" width="260" alt="Bills due, renewals, money in and out."><br>**Overview**<br>[Short](./business/shorts/asklocker-business-overview-9x16.mp4) · [no music](./business/shorts/asklocker-business-overview-9x16-sfx-only.mp4) · [1:1](./business/posters/asklocker-business-overview-1080x1080.png) · [16:9](./business/posters/asklocker-business-overview-1920x1080.png) |
| <img src="business/posters/asklocker-business-reminders-1080x1080.png" width="260" alt="Renew it before it lapses."><br>**Reminders ★**<br>[Short](./business/shorts/asklocker-business-reminders-9x16.mp4) · [no music](./business/shorts/asklocker-business-reminders-9x16-sfx-only.mp4) · [1:1](./business/posters/asklocker-business-reminders-1080x1080.png) · [16:9](./business/posters/asklocker-business-reminders-1920x1080.png) | <img src="business/posters/asklocker-business-team-1080x1080.png" width="260" alt="Your team and your CA, by invitation."><br>**Team**<br>[Short](./business/shorts/asklocker-business-team-9x16.mp4) · [no music](./business/shorts/asklocker-business-team-9x16-sfx-only.mp4) · [1:1](./business/posters/asklocker-business-team-1080x1080.png) · [16:9](./business/posters/asklocker-business-team-1920x1080.png) | <img src="business/posters/asklocker-business-share-1080x1080.png" width="260" alt="Send one record. Not the whole vault."><br>**Share by link**<br>[Short](./business/shorts/asklocker-business-share-9x16.mp4) · [no music](./business/shorts/asklocker-business-share-9x16-sfx-only.mp4) · [1:1](./business/posters/asklocker-business-share-1080x1080.png) · [16:9](./business/posters/asklocker-business-share-1920x1080.png) |
| <img src="business/posters/asklocker-business-access-1080x1080.png" width="260" alt="Your records, sent and stored encrypted."><br>**Access and control**<br>[Short](./business/shorts/asklocker-business-access-9x16.mp4) · [no music](./business/shorts/asklocker-business-access-9x16-sfx-only.mp4) · [1:1](./business/posters/asklocker-business-access-1080x1080.png) · [16:9](./business/posters/asklocker-business-access-1920x1080.png) | <img src="business/posters/asklocker-business-sheets-1080x1080.png" width="260" alt="Ask your Excel sheets in plain words."><br>**Spreadsheets**<br>[Short](./business/shorts/asklocker-business-sheets-9x16.mp4) · [no music](./business/shorts/asklocker-business-sheets-9x16-sfx-only.mp4) · [1:1](./business/posters/asklocker-business-sheets-1080x1080.png) · [16:9](./business/posters/asklocker-business-sheets-1920x1080.png) |  |

★ Reminders need a paid plan (Plus and up).

## Before posting

- **The plans and prices** are the ones of 27 October 2026 (Family Plus ₹99 a
  month, business plans from ₹499 + GST). They change without a release:
  check them against the app's Plans page first.
- **Gmail import is still in testing.** Until Google verifies AskLocker's
  Gmail access, only listed test users can connect a mailbox, and the family
  film shows it (it is not in the feature shorts or posters). Hold the family
  film back from the public until then, or ask for a cut without it.
- **Business vaults are a pilot**: paid business plans are set up by hand.
- **Say what the app does, never more** (`CLAUDE.md`, Conventions): never
  "secure", "safe" or "100% private". "Sent and stored encrypted" and "In
  AskLocker, only your family can open them" are the words to use, as the
  posters do; documents are not end-to-end encrypted.

## Making them again

After a change to the app or the words, from `video/`:

```bash
./tools/films.sh       # the eight film cuts, with sound
./tools/features.sh    # every feature short and poster
./tools/publish.sh     # copy them here
```

The language versions of the family short (its voice scene in each of the
app's ten voice languages) are not kept here, to keep the repository small:
`node tools/render.mjs --portrait --short --lang ta`, then `./tools/mux.sh
family-9x16-short-ta`, makes one.
