# Marketing

Go-to-market material for AskLocker. Nothing here is part of the app build:
Metro only bundles from `src/app`, and none of these files are TypeScript.

- `family/`, `nri/` and `business/`: the finished films, feature shorts and
  posters, ready to post (below).
- `privacy/`: what AskLocker does with a family's documents today, in plain
  words: the full film, and four Instagram reels to post one a week
  ([below](#privacy-a-month-of-reels)). **Held back**: the encryption brief
  of 3 November 2026 keeps it unpublished.
- `launch/`: **embargoed until end-to-end encryption ships.** The launch
  set: every film, short and reel saying "Locked on your phone. Opened only
  by your family." ("by your team" for a business), and the launch's own
  film, for a family and for a business. Nothing in it is posted before the
  owner confirms the launch; see [`launch/README.md`](launch/README.md).
- `video/`: the code that makes them: both films and every feature's short and
  poster, in 16:9, 9:16 and 1:1. See [`video/README.md`](video/README.md) to
  render them.
- `strategy/index.html`: the go-to-market strategy, written for engineers
  (problem as an incident report, customer as a type, funnel as a pipeline with
  named events, a 90-day plan with exit gates, and a table of the product claims
  the code supports today). Open it in a browser; the film plays once the rendered
  files sit in `strategy/media/`, which is not committed.

`video/out/`, where everything is rendered, is gitignored; `video/tools/publish.sh`
copies the finished files into `family/`, `nri/`, `business/` and `privacy/`, which are committed.
All of it shows a fictional family and business and SPECIMEN papers, so it can
be shared publicly.

## What's where

| Folder | What | Shapes |
|---|---|---|
| `family/films/` | The family film: a night when a policy number can't be found, then the same night with AskLocker | 2:15 in [16:9](./family/films/asklocker-family-16x9.mp4) and [9:16](./family/films/asklocker-family-9x16.mp4); 1:11 in [16:9](./family/films/asklocker-family-16x9-short.mp4) and [9:16](./family/films/asklocker-family-9x16-short.mp4) |
| `nri/films/` | The family film for Indians abroad: the same night, told by a son in Toronto who looks after his parents' papers from there | 2:15 in [16:9](./nri/films/asklocker-nri-16x9.mp4) and [9:16](./nri/films/asklocker-nri-9x16.mp4); 1:11 in [16:9](./nri/films/asklocker-nri-16x9-short.mp4) and [9:16](./nri/films/asklocker-nri-9x16-short.mp4) |
| `business/films/` | The business film: a formal product film for shops, clinics and CAs | 1:31 in [16:9](./business/films/asklocker-business-16x9.mp4) and [9:16](./business/films/asklocker-business-9x16.mp4); 0:59 in [16:9](./business/films/asklocker-business-16x9-short.mp4) and [9:16](./business/films/asklocker-business-9x16-short.mp4) |
| `family/shorts/`, `business/shorts/` | One feature each: why it exists, the app doing it, the end card | 9:16, 14 to 21 seconds, with music, and `-sfx-only` without it |
| `family/posters/`, `business/posters/` | One feature each: its line, and the phone showing it | 1:1 (`1080x1080`) and 16:9 (`1920x1080`) |
| `privacy/films/` | What happens to your documents: where they're kept, who can open them, what the AI gets, every service, and taking it back | 2:16 in [16:9](./privacy/films/asklocker-privacy-16x9.mp4) and [9:16](./privacy/films/asklocker-privacy-9x16.mp4) |
| `privacy/reels/` | Four reels from it, one a week (below) | 9:16, 27 to 31 seconds, with music, and `-sfx-only` without it |
| `privacy/covers/` | Each one's cover: the frame that says the most | the reels' 1080x1920, the film's in both shapes |

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

## Privacy: a month of reels

> **On hold.** The encryption brief of 3 November 2026 keeps this film and
> its reels unpublished: AskLocker is building end-to-end encryption, and
> the launch set (`launch/`) will replace them once it ships. The plan
> below stays for reference.

The privacy film says what AskLocker does with a family's documents, the
honest parts included: encrypted on the way and where they're kept (in
Mumbai), but not end-to-end, so our servers read them to answer you and the
people who run AskLocker can open them. It shows exactly what the AI is sent
for one question. Every line follows the privacy policy
([asklocker.com/privacy](https://asklocker.com/privacy)) or the code; the
claims and their sources are in [`video/README.md`](video/README.md#the-privacy-film).

Post the full film first and pin it (as a reel, a 9:16 video of 2:16), then
one reel a week, for example on Tuesdays:

| Week | Reel | It answers | Caption |
|---|---|---|---|
| 1 | [What the AI sees](./privacy/reels/asklocker-privacy-ai-9x16.mp4) · [no music](./privacy/reels/asklocker-privacy-ai-9x16-sfx-only.mp4) · [cover](./privacy/covers/asklocker-privacy-ai-cover.png) | What does the AI actually see? | You ask a question. The AI gets your question, who "Papa" is, and the passages that match it, up to 15, and writes the answer from the best. Never your files. Never your whole vault. The whole policy: asklocker.com/privacy |
| 2 | [Who can open them](./privacy/reels/asklocker-privacy-who-9x16.mp4) · [no music](./privacy/reels/asklocker-privacy-who-9x16-sfx-only.mp4) · [cover](./privacy/covers/asklocker-privacy-who-cover.png) | Who can open your documents? | People in your vault, and anyone you send a link to, for that one document. Encrypted, but not end-to-end: our servers read them to answer you, our team can open them, and the services we use read parts of them for us. We'd rather you hear it from us. asklocker.com/privacy |
| 3 | [Where they go](./privacy/reels/asklocker-privacy-where-9x16.mp4) · [no music](./privacy/reels/asklocker-privacy-where-9x16-sfx-only.mp4) · [cover](./privacy/covers/asklocker-privacy-where-cover.png) | Where do your documents go? | Encrypted on the way, and where they're kept, in Mumbai. Photos you add are read on your own phone; one it can't read goes to OCR.space. asklocker.com/privacy |
| 4 | [Taking it back](./privacy/reels/asklocker-privacy-control-9x16.mp4) · [no music](./privacy/reels/asklocker-privacy-control-9x16-sfx-only.mp4) · [cover](./privacy/covers/asklocker-privacy-control-cover.png) | Can you take it all back? | Send one document with a link that stops when you say. Delete your account and it goes at once. Copies in backups and logs expire on their own. asklocker.com/privacy |

Hashtags, if you use them: #AskLocker #FamilyDocuments #DataPrivacy
#AIWithCare #PersonalFinanceIndia.

The 16:9 film is for the website's privacy page, YouTube and LinkedIn.
Instagram covers its own buttons and caption over the edges of a reel; the
reels keep everything they say inside the space it leaves (the top 220 px and
bottom 350 px stay clear).

## Before posting

- **The plans and prices** are the ones of 27 October 2026 (Family Plus ₹99 a
  month, business plans from ₹499 + GST). They change without a release:
  check them against the app's Plans page first.
- **Gmail import is still in testing.** Until Google verifies AskLocker's
  Gmail access, only listed test users can connect a mailbox, and the family
  and NRI films show it (it is not in the feature shorts or posters). Hold
  both films back from the public until then, or ask for cuts without it.
- **The NRI film's end card shows the rupee price** (₹99 a month), which
  anyone in the family in India can pay. Paying from abroad is in dollars
  ($10 a month) and works only once Razorpay takes dollars
  (`RAZORPAY_CURRENCIES=INR,USD`). Until then the app tells someone abroad that
  paying from there is coming soon. Reminders arrive at 9 in the morning India
  time, which is the evening before in Toronto, and the film shows that.
- **Business vaults are a pilot**: paid business plans are set up by hand.
- **The privacy film says two things the privacy policy doesn't yet**, both
  true of the code: a follow-up question sends the last few messages of the
  chat to the AI with it (rag-search's history, up to six messages of 600
  characters), and a photo the phone can't read is sent to OCR.space
  (`_shared/ingest.ts` reads it on the server when the app sends no text).
  The policy says Anthropic and Groq get "your question and the best matching
  parts", and that photos you upload are read on your own device. Add both to
  `public/privacy.html` (and its date) before posting the privacy film or its
  reels, so the film never says more than the page it sends people to.
- **Say what the app does, never more** (`CLAUDE.md`, Conventions): never
  "secure", "safe" or "100% private". "Sent and stored encrypted" and "In
  AskLocker, only your family can open them" are the words to use, as the
  posters do; documents are not end-to-end encrypted.
- **Nothing negative for the person reading** (the owner, 3 November 2026):
  never what AskLocker can't do for them ("we can't recover it for you").
  Say what gets them back in: keep the Recovery Key safe. And don't say
  AskLocker has no ads, in captions either.

## Making them again

After a change to the app or the words, from `video/`:

```bash
./tools/films.sh       # the twelve film cuts, with sound
./tools/privacy.sh     # the privacy film, its four reels and their covers
./tools/features.sh    # every feature short and poster
LAUNCH=1 ./tools/films.sh && LAUNCH=1 ./tools/features.sh   # the launch set,
./tools/locked.sh && ./tools/locked.sh business             # and its own film, both versions
./tools/publish.sh     # copy them here (the launch set into launch/)
```

The language versions of the family short (its voice scene in each of the
app's ten voice languages) are not kept here, to keep the repository small:
`node tools/render.mjs --portrait --short --lang ta`, then `./tools/mux.sh
family-9x16-short-ta`, makes one.
