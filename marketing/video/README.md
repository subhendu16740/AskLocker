# AskLocker films

Two launch films, as code: one for families, one for business, and a poster
and a short for each feature (below). `src/intro.html` builds any of them as a
GSAP timeline (`?film=family`, `?film=business` or `?film=features`) that
recreates the app's real screens (same layouts, copy, colours and Feather icons
as `src/app/**`, sized by `src/constants/design.ts`; a business's screens in the
app's teal, as Business mode has them). `tools/render.mjs` seeks the paused
timeline frame by frame in headless Chromium and pipes PNGs to ffmpeg, so every
frame is deterministic. `audio/score.py` synthesises the soundtrack from the cue
sheet the page emits, so sound lands on the exact frame of each tap, and mixes
in the family film's two spoken lines from `audio/voices/`.

The two films are told differently, on purpose. The family film is a story: a
night when a document can't be found, then the same night with AskLocker, and
every product scene opens with a **Why**, the problem it exists for, read first
and large, before the **How**, AskLocker's answer, while the phone does it. The
business film is a formal product film: no story, a structure an owner or their
CA can follow at a glance.

**For families** (`src/family.js`): a 2:14 AM hospital admission, a son who
can't find his father's policy, and the same night with AskLocker. The product
half follows one family through the app: documents brought in from Gmail
(★ Family Plus), a paper policy scanned and filed in the family's vault, a
question typed, the same question asked aloud in Hindi, the family tree with
the names the family uses, Papa's emergency card, a reminder arriving on the
lock screen (★ Family Plus), and who can open what. The voice scene names all
ten voice languages in their own scripts, and you hear it work: Maa asks her
question aloud in Hindi, and the app reads its answer back to her, policy
number spelled out, with English subtitles under both.

**For business** (`src/business.js`): a title card, then the challenge in two
statements: what a business keeps (eight kinds of papers), and the dates inside
them, Arora Electric's next 90 days on one timeline. Then the product in five
parts, and the five as numbered chapters, each a heading, three points and the
plan it needs, beside the phone doing it: **01 Capture**, a supplier's bill
photographed, filed under Purchase Bills and read (GSTIN, bill number, total,
due date); **02 Ask**, a question answered from that bill; **03 Overview**,
renewals and bills due, one marked paid, and money in and out (Plus, and Pro
for the money); **04 Reminders**, an expiry reminder and a note's reminder on
the lock screen (Plus); **05 Team**, the CA invited. In 16:9 a bar across the
top marks the chapter. Then access and control in four cards, the four plans
side by side, and a closing card. It stays in daylight throughout, in Business
mode's teal with its gold for numbers, and its music is one steady piece.

Both phones are the installed web app on Android, so the status bar takes the
app's theme colour, navy in both modes.

| Output | Length | For |
|---|---|---|
| `asklocker-family-16x9.mp4` | 2:15 | Landing page, YouTube, LinkedIn, pitches |
| `asklocker-family-9x16.mp4` | 2:15 | Full-length vertical posts |
| `asklocker-family-9x16-short.mp4` | 1:11 | Reels, Shorts, WhatsApp forwards |
| `asklocker-family-16x9-short.mp4` | 1:11 | LinkedIn and X feeds |
| `asklocker-business-16x9.mp4` | 1:31 | Landing page, YouTube, LinkedIn, pitches to businesses and CAs |
| `asklocker-business-9x16.mp4` | 1:31 | Full-length vertical posts |
| `asklocker-business-9x16-short.mp4` | 0:59 | Reels, Shorts, WhatsApp forwards |
| `asklocker-business-16x9-short.mp4` | 0:59 | LinkedIn and X feeds |
| `…-sfx-only.mp4` | same | Posting with a platform's own music: effects and voices, no music |
| `asklocker-family-9x16-short-ta.mp4` … | about 1:10 | The family short with its voice scene in one of the app's ten voice languages (below) |

**The voice scene in every voice language.** The family film's two short
cuts also come in each of the app's ten voice languages: English (`en`),
Hindi (`hi`), Bengali (`bn`), Tamil (`ta`), Telugu (`te`), Marathi (`mr`),
Gujarati (`gu`), Kannada (`kn`), Malayalam (`ml`) and Punjabi (`pa`), named
`asklocker-family-<9x16|16x9>-short-<code>.mp4`. Only the voice scene changes:
Maa asks in that language and the app answers in it, on the screen and aloud,
with English subtitles under both (none in English, where the phone already
shows the words). Every headline stays in English. The voice screen shows the
app's own phrases (the placeholder, Listening…, Cancel, Stop) in English,
except in Hindi, because the app has them only in those two and falls back to
English. The full-length cuts keep the Hindi of the main film.

The family short keeps the story and one pass through the product: Gmail
import, Ask, and the Hindi voice answer. It drops the statistic, Scan, the
family tree, the emergency card, Reminders and Privacy, and leaves the voice
scene after the answer's first sentence, the policy number; the second sentence
carries on over the night scene, on Maa's phone. The business short keeps the
title, the challenge, the five parts, chapters 01 to 03 (Capture, Ask and
Overview), the plans and the closing card; it drops Reminders, Team, and access
and control.

**Feature posters and shorts** (`src/features.js`): one feature at a time,
nine for families with the Sharmas and eight for business with Arora Electric.
Each has a **poster**, its line on the left and the phone on the right showing
the feature, with a callout over the phone's edge (`asklocker-<feature>-1920x1080.png`
and `-1080x1080.png`, in `out/posters/`), and a **short**, 9:16 and 14 to 21
seconds: why the feature exists, how AskLocker answers it while the phone does
it, the callout, and the end card (`asklocker-feature-<feature>-9x16.mp4`). The
voice short plays Maa's Hindi question and the answer read back, with English
subtitles; the business ones wear Business mode's teal and gold. They use the
films' own screens and people, and a few screens only they need
(`src/feature-screens.js`): a document's page with what was read off it (the
policy, and the supplier's bill), its share sheet, the lock a fingerprint
opens, Upload's "Where should this go?", and a spreadsheet read and asked
about. `tools/publish.sh` copies them, with the films, into the repository's
`marketing/` folder (below).

| For families (`?feature=`) | Poster's headline | Short's how |
|---|---|---|
| `ask` | Ask your documents anything. | Just ask, the way you'd ask a person. |
| `read` | Snap a page. Know what it says. | Snap it. AskLocker reads it. |
| `voice` | Ask out loud. Hear the answer. | Ask out loud. Hear the answer. |
| `reminders` | Renew it before it runs out. | Everyone is reminded in time. |
| `tree` | It knows who "Dadi" is. | Ask by relation. It knows who you mean. |
| `emergency` | What the doctor asks, one tap away. | One emergency card for each person. |
| `share` | Send one document. Not your whole vault. | Send a link that expires. |
| `vaults` | Your papers, sent and stored encrypted. | Sent and stored encrypted. |
| `fingerprint` | Open it with a touch. | Open it with your fingerprint. |

| For business (`?feature=`) | Poster's headline | Short's how |
|---|---|---|
| `biz-capture` | Snap a bill. Know what it says. | Snap it. AskLocker files it and reads it. |
| `biz-ask` | Ask your records anything. | Ask anything. Get the answer and its source. |
| `biz-overview` | Bills due, renewals, money in and out. | One overview, read from your papers. |
| `biz-reminders` | Renew it before it lapses. | Reminded before anything lapses. |
| `biz-team` | Your team and your CA, by invitation. | Invite your team and your CA. |
| `biz-share` | Send one record. Not the whole vault. | Send a link that expires. |
| `biz-access` | Your records, sent and stored encrypted. | Sent and stored encrypted. |
| `biz-sheets` | Ask your Excel sheets in plain words. | AskLocker reads it. You just ask. |

Rendered files go to `out/`, which is not committed; `tools/publish.sh` copies
the finished films, shorts and posters into `marketing/family/` and
`marketing/business/`, which are (see `marketing/README.md`).

## Render

Needs Node 22, Python 3 with `numpy` and `scipy`, and an ffmpeg built with
libx264. Playwright's Chromium does the drawing.

```bash
cd marketing/video
npm install
npx playwright install chromium       # skip if Chromium is already provisioned
python3 -m pip install numpy scipy

node tools/render.mjs                             # family, 16:9, full -> out/video-family-16x9.mp4
node tools/render.mjs --film business --portrait  # business, 9:16    -> out/video-business-9x16.mp4
node tools/render.mjs --film business --portrait --short
node tools/render.mjs --portrait --short --lang ta   # the family short, voice scene in Tamil -> family-9x16-short-ta
./tools/mux.sh family-16x9             # adds sound -> out/asklocker-family-16x9.mp4
./tools/mux.sh business-9x16-short     # tag = film, orientation, and -short for the short cut
```

`FFMPEG=/path/to/ffmpeg` and `PYTHON=/path/to/python` override the defaults.
The spoken lines are committed WAVs, so rendering needs no speech engine.
A full cut takes about eight minutes on four cores (`--workers 3` renders three
slices in parallel and joins them losslessly).

The feature posters and shorts, every film cut at once, and the copy into
`marketing/`:

```bash
./tools/features.sh                   # every short, with sound, and every poster
./tools/features.sh voice biz-share   # some of them
node tools/posters.mjs --features ask --sizes 1080x1080 --scale 2   # one poster, at 2x
node tools/render.mjs --film features --feature ask --portrait      # one short, no sound yet
./tools/mux.sh feature-ask-9x16                                     # -> out/asklocker-feature-ask-9x16.mp4
./tools/films.sh                      # all eight film cuts, with sound (or name some: business-9x16)
./tools/publish.sh                    # out/ -> marketing/<family|business>/<films|shorts|posters>/
```

A poster is the frame the feature names (`window.__hero`), taken as a PNG at
any size (`--sizes 1920x1080,1080x1080` by default). A short takes two to
three minutes on four cores; all seventeen, about 45 minutes; all eight film
cuts, about two hours. `publish.sh` replaces the six folders in `marketing/`
with what `out/` holds, so render everything first. The films go there with
music; the shorts with and without.

Single frames, for checking a change without a full render:

```bash
node tools/render.mjs --stills 4.6,40,62.4                 # -> out/stills/family-16x9-*.png
node tools/render.mjs --film business --portrait --stills 53
```

To watch it live, serve this folder (`npm run preview`) and open
`src/intro.html?film=business` (or `?film=family`), adding
`&orientation=portrait` or `&cut=short`; a feature is
`?film=features&feature=share&orientation=portrait` (its short) or
`&size=1080x1080` (its poster, playing). Space pauses, arrow keys scrub, number
keys jump to tenths of the film.

## Change it

- **What both films share**: `src/engine.js` builds the stage and holds the
  timeline helpers (taps, typing, screen pushes, the why-then-how text, callouts,
  the drawer); `src/parts.js` holds the screen parts both films draw (top bar,
  tab bar, lock screen, call, camera, Ask's bubbles and input, the end card).
  `src/main.js` only picks the film.
- **The people, the documents, the end card**: `STORY` at the top of
  `src/family-screens.js` and `BIZ` at the top of `src/business-screens.js`.
  `ctaNote` is the line under the call to action (the price); set `STORY.url`
  before publishing to show an address.
- **Headlines and captions**: `textBlocks()` in each film's screens file. In
  the family film (with `subtitles()` for the Hindi lines) each feature scene is
  one `whyHow()` call: the problem, then the fix and its paragraph. In the why,
  `*stars*` mark the coral emphasis, `|` breaks the line and `~` is a space that
  never breaks. In the business film each statement is a `block()` (label,
  heading, what follows) and each chapter a `chapter()` (heading, three points,
  the plan it needs); `CHAPTERS` names the five parts and `DUE` holds the
  timeline's dates. In 9:16 a chapter's callout takes the place of its points.
- **The business film's look**: `build({ look: 'formal' })` puts `formal` on
  the stage, and the `.formal` and `.fm-*` rules at the end of `src/styles.css`
  style it, 16:9 and 9:16 apart.
- **Timing and choreography**: the numbered scenes in `src/family.js` and
  `src/business.js`. Each scene starts where the previous one ends, so
  lengthening one shifts the rest; the soundtrack follows automatically because
  it is built from the cue sheet.
- **The music**: `audio/score.py`. The family film's follows its story (night,
  day, night again). The business film's is `formal_music()`, one piece in
  D major at 100 bpm: pad and piano under the title and the challenge, a groove
  (bass, arpeggio, soft kick and shaker) from the five parts on, a rest for
  access and control, the groove again with a bell line for the plans, and a
  resolve on D for the closing card. Each part starts on a `section` cue from
  the timeline, so a downbeat lands on each change of scene.
- **The spoken lines**: `LINES` in `tools/voices.py`, then run it (below). It
  writes `audio/voices/ask-hi.wav` and `answer-hi.wav`, and `src/voices.js`
  with how long each runs and where the policy number starts in the answer;
  the voice scene and the night scene time themselves from that file, so a
  longer line lengthens the film by itself.
- **The voice scene's languages**: `src/voice-lines.js` holds what the screen
  shows in each (the question, the answer and the app's own phrases), and
  `LINES` in `tools/voices_indic.py` what each voice says, with the numbers as
  words. Run it (below) to remake `audio/voices/lang/<code>-ask.wav`,
  `<code>-answer.wav` and `src/voices-langs.js`, their timings.
- **A feature poster or short**: its entry in `FEATURES` in `src/features.js`
  holds its words (the short's `why` and `how`, the poster's `head` and
  `line`, where `*stars*` mark the emphasis), its screens, the taps and
  timings of its `play()`, and how high its callout sits on a 16:9 poster
  (`coY`). The callouts' words are `CALLOUTS` in `src/feature-screens.js`. A
  short's why stays for its first two and a half seconds, then the how while
  the phone works, then the callout in the how's place; `play()` returns when
  each comes, the poster's moment (`hero`) and the end. Their music is
  `short_music()` in `audio/score.py` (a business feature takes the business
  film's).
- **Fonts**: `tools/fetch-fonts.sh` refreshes the local copies in `fonts/`.
- **Icons**: add a Feather name to `NEEDED` in `tools/build-icons.mjs` and rerun it.

### The voices

The language versions' lines are spoken by AI4Bharat's
[Indic Parler-TTS](https://huggingface.co/ai4bharat/indic-parler-tts) (Apache
2.0), which speaks all ten languages from text and was trained on Indian
speakers; Kokoro has no voices for the regional ones. Each language has two of
its named speakers, one for Maa and one for the app. Each sentence of the
answer is one take, so it flows; to find where the policy number starts, the
words before it are said alone too and matched against the sentence, pauses
left out (`number_onset()`). Every line is spoken in all ten languages at once,
in one batch, and a take that runs too fast or too slow for its words, or
stops too long, is drawn again. The model is gated: accept its terms on
Hugging Face and set `HF_TOKEN`, or pass `--model` a folder holding its files.

```bash
python3 -m pip install torch torchaudio parler-tts scipy
HF_TOKEN=hf_... python3 tools/voices_indic.py            # all ten, about 25 minutes on a 4-core CPU
HF_TOKEN=hf_... python3 tools/voices_indic.py --langs ta  # one
```

The lines are first drafts. Have someone who speaks each language read its
lines in `src/voice-lines.js` and listen to its voices before that version goes
out. Maa calls her husband what a mother of that language would to her
children's app (Papa, Baba, Appa, Nanna, Achan).

Listen for every word, not only how it sounds: the model samples, and a take
can drop words and still pass the pace check. A brisker Tamil take read the
policy number without "A S H"; Tamil's first sentence is the one of six new
takes that said the letters (it has the hiss of the S and H right after the
number's mark, as every language's has). Gujarati is the model's weakest
language (two speakers, 21 hours of training data, the lowest naturalness
score on its model card) and reads slowly even at a brisker pace, with long
pauses, which its lines cut to 0.3 s. Punjabi is supported unofficially. Tamil
and Gujarati ask for a brisker app voice (`pace` in `LINES`).

The main film's two Hindi lines are spoken by
[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) v1.0, an open
text-to-speech model (Apache 2.0), from espeak-ng's Hindi phonemes, the way
Kokoro's own pipeline reads Hindi. Maa is the voice `hf_beta`; the app is
`hm_omega`, a different voice so that question and answer never sound like the
same person. `score.py` plays the answer through a phone-sized speaker, and at
night through the same speaker across a room, and lowers the music by 15 dB
while anyone speaks. The business film has no spoken lines.

```bash
apt install espeak-ng
python3 -m pip install numpy onnx onnxruntime phonemizer-fork
# onnx/model.onnx and voices/ from huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
python3 tools/voices.py --model model.onnx --voices voices/
```

Word timings come from the model itself (each sound's length, read out of the
graph), not from the waveform, so the night scene starts on the number's first
letter. Kokoro's Hindi voices are its least practised, so have a Hindi speaker
listen to both lines before the film goes out. Two words are already handed to
them in other spellings (`SAY` in `tools/voices.py`), while the screen keeps the
usual ones: from हेल्थ espeak gives Hindi's long e and an aspirated t, which came
out as "hayl-t-huh", so the voice is given "health"; and it reads इंश्योरेंस's
anusvaras as nasal vowels with no n, so the voice is given इन्श्योरेन्स. The
answer says the policy is वैलिड, as people say it, not वैध, whose aspirated
ending trips the voice the same way.

## Keep it honest

The films may only claim what the app does, and the app's own rule holds for
them too: never promise more privacy than AskLocker gives (CLAUDE.md,
Conventions). So the privacy scenes say "In AskLocker, only your family can
open them" (or "your team"), never "secure", "safe" or "private and isolated",
and the line under the cards says that search sends passages to outside AI
services, which Settings › Privacy names. "Encrypted" appears only as the
agreement everyone accepts says it (`_shared/agreement.ts`): "Sent and stored
encrypted", on the privacy poster and short, never "end-to-end". Some details
were chosen deliberately:

- **★ marks what needs a plan**, as the app does: Gmail import, expiry
  reminders (048) and 30-day share links are Family Plus for a family; a
  business's Overview renewals and bills, reminders and notes' reminders need a
  paid plan (Plus and up), and money in and out needs Pro, which the business
  film's chapters say in their plan lines ("from Plus", "from Pro"). The
  Sharmas are on Family Plus and Arora Electric on Pro, so every screen shown
  is one they would see.
- **The business film's timeline holds only dates AskLocker reads.** Its
  challenge shows Arora Electric's next 90 days: two supplier bills due, an
  invoice to collect, the shop insurance and the godown lease, the same five
  that Overview lists later. It shows no GST filing dates or other deadlines
  from the tax calendar: AskLocker does not track them, and the film must not
  suggest it does.
- **The plans table is `plan_limits`** as 067 left it: people 2, 5, 10 and
  50; space 100 MB a person on Free, then 20 GB, 50 GB and 200 GB; questions
  20 a person a month on Free, and a month shared by the business on a paid
  plan (1,000, 2,000 and 8,000). The prices are `BUSINESS_PRICE`, before GST,
  and a year costs about ten months. Paid business plans are given by hand, so
  the film says they are set up on request. The limits are rows that change
  without a release: check the table against the app before publishing.
- **Gmail import's rows are what the app would show.** Each file name, sender
  and subject was run through `classifyAttachment` in
  `supabase/functions/_shared/gmail-rules.ts`; the reasons ("file name says
  statement") and categories on screen are its answers. The senders are generic
  ("Card Statements", "Rail Bookings") so that no real bank or insurer appears.
  Gmail import is web only, and while Google's verification of the Gmail scope
  is pending only listed test users can connect: don't put the family film in
  front of the public before that is done, or cut the Gmail scene from the short.
- **A photographed page is saved as `scan_<Date.now()>.jpg`** (`upload.tsx`), so
  that is the name on the upload screen, on the answer's source chip and in
  Overview's bills.
- **The papers say what the extractor reads.** The policy's labels ("Policy
  Number", "Sum insured", "Valid till") and the bill's ("Supplier", "Bill No",
  "Bill Date", "Payment due by", "Total Amount Payable") are the ones
  `supabase/functions/_shared/metadata.ts` and `doc-category.ts` read, so the
  callouts show what the app would pull out, and the category it would suggest
  ("Supplier" files the bill under Purchase Bills, as only a photo's text,
  read on the phone, can). Every GSTIN has a valid check character, or the
  extractor would store none. The insured's name ends in "(Self)", where the
  name pattern stops: without it the pattern carried on into the next line.
- **Upload asks where the file goes.** Rohan has the personal vault every
  account gets as well as Sharma Family, so the family film picks the vault
  before "Who does this belong to?" opens (046). Kavita has one business, so
  the business film's Upload goes straight to the category.
- **Names are the family's own.** The tree, the upload chips, Papa's page and
  his emergency card show the English relation and the family's nickname
  (`Father · "Papa"`, 045), never a Hindi word made up for someone; the
  "Ask by relation" callout shows what `relativesNamedIn()` in
  `supabase/functions/_shared/kinship.ts` resolves from a question.
- **The reminders are web push**, as `public/sw.js` shows them: the title and
  body are the server's own wording (034, 035, 051), at 9:05 because reminders
  are made from 9 in the morning, India time, and pushed at five past the hour.
  The shop insurance's reminder says "expires in 30 days" because its 30-day
  stage is the one due that morning.
- **Overview's numbers are read, not checked**, and the film says so (the
  callout, and the app's own line under the cards). Marking a bill paid is only
  a marker: there is no accounting or GST filing in the app, and the film
  claims none.
- **The CA joins by invitation.** She shows as Pending approval until she
  accepts, and once in, as a viewer, she sees every record the business keeps:
  there are no per-folder permissions yet, and the film does not suggest any.
- **The voice languages** are the list in `src/lib/voice-languages.ts`:
  English (India), Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada,
  Malayalam and Punjabi. Whether a phone can speak a language depends on the
  voices it has, which the line under the cards says. The business film's
  "Ask by voice in Hindi and 9 more languages" is the same list: Ask sends the
  voice language with a spoken question, and rag-search answers in it. Typed
  questions carry no language, so the film claims it for voice only.
- **The spoken answer is what the app would say.** It is the answer on the
  screen as `toSpeech()` (`src/lib/speech-text.ts`) hands it to the phone's
  voice: the policy number spelled out, in groups of four ("A S H 2, 3 1 1 4,
  5 8 9"). The letters are written as a Hindi voice says them (ए एस एच),
  because espeak would read a lone "A" as the English article. The app reads
  with the phone's own voices, so on a real phone the voice will differ; the
  film's is a stand-in for one.
- **The family has 4 members** (Family Plus allows 4); Dadi, Neha and Aarav
  are in the tree without accounts, which the tree allows. **Arora Electric
  has 3 of Pro's 10**, and the CA's invitation holds a place until she answers.
- **The end cards' prices** are `PLUS_PRICE` (Family Plus, ₹99 a month) and
  `BUSINESS_PRICE` (from ₹499 a month, plus GST) in
  `supabase/functions/_shared/plan-text.ts`. A business plan is set up by hand
  ("Ask us"), and business vaults are a pilot for a few businesses, so check
  what the app offers before publishing either film.
- **Ask's category chips** are the vault's own kind in each film: family
  categories for the Sharmas, a business's for Arora Electric. The app lists
  the first eight categories of every kind there (`fetchCategories` does not
  filter by audience), so today a family sees Business Insurance among them and
  a business sees Birth Certificate, until that is fixed; the films show what
  it should.

The feature posters and shorts keep the same rules, and a few of their own:

- **"Extracted Data" is what the extractor reads.** The four rows on the
  policy's page (expiry date, policy number, name, amount) are what
  `extractMetadata` returns for the policy paper's text, in that order (the
  name stops at "(Self)", above).
- **The share link was made the day the policy was added**, 1 November, for
  7 days, so it works until 8 November; 30 days needs Family Plus, which the
  callout says. The link is 64 hex characters after `#`, as `/s` links are.
- **The passkey sheet is the phone's**, drawn without any company's name or
  look: the lock screen is AskLocker's own (`app-lock-screen.tsx`), and what
  asks for the finger is the device.
- **The spreadsheet is read as the app reads one**: "Read 245 rows from 3
  sheets" is Upload's own line; "Invoice No" in its first rows files it under
  Sales Invoices (`doc-category.ts`); and the answer comes from one row of its
  Summary sheet, which says the month's total, so nothing is added up by the
  model.
- **Reminders reach everyone in the family on Family Plus**, and a phone shows
  them once its owner turns notifications on there; on Free, one reminder 30
  days before, to whoever added the document (067), which the callout says.
- **The bill's page shows what the extractor reads off it**: its total, both
  GSTINs, the bill number, its date and when it is due, in the order
  `extractMetadata` returns them. A business has no family tree, so the page
  names nobody it belongs to.
- **A business's share sheet says "You or an admin can turn it off."** The
  app's sheet says "a family admin" in a business too, which is its slip: in a
  business, whoever made a link or any admin turns it off. The film shows what
  it should, as it does for Ask's categories (above).
- **My notes are each person's own** (056), which the business privacy short
  shows with the app's own line ("Nobody else in the team can open them").
  Reminders on notes, and renewal reminders, need a paid plan (★ Plus).

The Sharma family, Arogya Shield, Arora Electric, Mehta Cables, its bill and
everyone in them are fictional; the papers carry a SPECIMEN watermark, the
email addresses in the business film are at example.com, and the phone numbers
on the emergency card are the app's own placeholder pattern. The logo is the
app's icon (`public/icon-512.png`): the locker and speech bubble of
`assets/expo.icon/Assets/asklocker-mark.svg`, placed and coloured as the icon
has them, so the two match pixel for pixel. The app was called FamilyVault
until 6 October 2026; the films say AskLocker everywhere a person sees the
name, as the app does.

## Licences

Fonts are from Google Fonts under the SIL Open Font License. Icons are Feather
(MIT). GSAP is used under its free standard licence. The soundtrack and sound
effects are generated by `audio/score.py`, so no audio licence is involved. The
voices are generated by Kokoro-82M and, for the language versions, Indic
Parler-TTS, both Apache 2.0; no recording or voice actor is involved.
