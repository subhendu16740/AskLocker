# AskLocker films

Two launch films, as code: one for families, one for business. `src/intro.html`
builds either as a GSAP timeline (`?film=family` or `?film=business`) that
recreates the app's real screens (same layouts, copy, colours and Feather icons
as `src/app/**`, sized by `src/constants/design.ts`; a business's screens in the
app's teal, as Business mode has them) around a short story. `tools/render.mjs`
seeks the paused timeline frame by frame in headless Chromium and pipes PNGs to
ffmpeg, so every frame is deterministic. `audio/score.py` synthesises the
soundtrack from the cue sheet the page emits, so sound lands on the exact frame
of each tap, and mixes in the family film's two spoken lines from
`audio/voices/`.

Every product scene in both films opens with a **Why**, the problem it exists
for, read first and large, and then shows the **How**, AskLocker's answer,
while the phone does it.

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

**For business** (`src/business.js`): 8:40 PM, the GST return due on the 20th,
the CA wants September's purchase bills, and they are in chats, inboxes, a
drawer and on the accounts clerk's computer. Then, with AskLocker: a supplier's
bill photographed, filed under Purchase Bills and read (GSTIN, bill number,
total, due date); a question answered with the bill attached; Overview's
renewals and bills due, one marked paid, and money in and out (★ Plus, ★ Pro);
an expiry reminder and a note's reminder on the lock screen (★ Plus); the CA
invited to the team; the Family | Business switch; and who can open what. The
same evening, the CA finds the bills herself.

Both phones are the installed web app on Android, so the status bar takes the
app's theme colour, navy in both modes.

| Output | Length | For |
|---|---|---|
| `asklocker-family-16x9.mp4` | 2:15 | Landing page, YouTube, LinkedIn, pitches |
| `asklocker-family-9x16.mp4` | 2:15 | Full-length vertical posts |
| `asklocker-family-9x16-short.mp4` | 1:11 | Reels, Shorts, WhatsApp forwards |
| `asklocker-family-16x9-short.mp4` | 1:11 | LinkedIn and X feeds |
| `asklocker-business-16x9.mp4` | 1:48 | Landing page, YouTube, LinkedIn, pitches to businesses and CAs |
| `asklocker-business-9x16.mp4` | 1:48 | Full-length vertical posts |
| `asklocker-business-9x16-short.mp4` | 1:01 | Reels, Shorts, WhatsApp forwards |
| `asklocker-business-16x9-short.mp4` | 1:01 | LinkedIn and X feeds |
| `…-sfx-only.mp4` | same | Posting with a platform's own music: effects and voices, no music |

The family short keeps the story and one pass through the product: Gmail
import, Ask, and the Hindi voice answer. It drops the statistic, Scan, the
family tree, the emergency card, Reminders and Privacy, and leaves the voice
scene after the answer's first sentence, the policy number; the second sentence
carries on over the night scene, on Maa's phone. The business short keeps the
story, Scan and file, Ask and Overview; it drops the unanswered call,
Reminders and notes, Team, Family and Business, and Privacy.

Rendered files go to `out/`, which is not committed.

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
./tools/mux.sh family-16x9             # adds sound -> out/asklocker-family-16x9.mp4
./tools/mux.sh business-9x16-short     # tag = film, orientation, and -short for the short cut
```

`FFMPEG=/path/to/ffmpeg` and `PYTHON=/path/to/python` override the defaults.
The spoken lines are committed WAVs, so rendering needs no speech engine.
A full cut takes about eight minutes on four cores (`--workers 3` renders three
slices in parallel and joins them losslessly).

Single frames, for checking a change without a full render:

```bash
node tools/render.mjs --stills 4.6,40,62.4                 # -> out/stills/family-16x9-*.png
node tools/render.mjs --film business --portrait --stills 53
```

To watch it live, serve this folder (`npm run preview`) and open
`src/intro.html?film=business` (or `?film=family`), adding
`&orientation=portrait` or `&cut=short`. Space pauses, arrow keys scrub, number
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
- **Headlines and captions**: `textBlocks()` and `subtitles()` in each film's
  screens file. Each feature scene is one `whyHow()` call: the problem, then the
  fix and its paragraph. In the why, `*stars*` mark the coral emphasis, `|`
  breaks the line and `~` is a space that never breaks.
- **Timing and choreography**: the numbered scenes in `src/family.js` and
  `src/business.js`. Each scene starts where the previous one ends, so
  lengthening one shifts the rest; the soundtrack follows automatically because
  it is built from the cue sheet.
- **The spoken lines**: `LINES` in `tools/voices.py`, then run it (below). It
  writes `audio/voices/ask-hi.wav` and `answer-hi.wav`, and `src/voices.js`
  with how long each runs and where the policy number starts in the answer;
  the voice scene and the night scene time themselves from that file, so a
  longer line lengthens the film by itself.
- **Fonts**: `tools/fetch-fonts.sh` refreshes the local copies in `fonts/`.
- **Icons**: add a Feather name to `NEEDED` in `tools/build-icons.mjs` and rerun it.

### The voices

The family film's two lines are spoken by
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
listen to both lines before the film goes out.

## Keep it honest

The films may only claim what the app does, and the app's own rule holds for
them too: never promise more privacy than AskLocker gives (CLAUDE.md,
Conventions). So the privacy scenes say "In AskLocker, only your family can
open them" (or "your team"), never "secure", "private and isolated" or
"encrypted", and the line under the cards says that search sends passages to
outside AI services, which Settings › Privacy names. Some details were chosen
deliberately:

- **★ marks what needs a plan**, as the app does: Gmail import, expiry
  reminders (048) and 30-day share links are Family Plus for a family; a
  business's Overview renewals and bills, reminders and notes' reminders need a
  paid plan (Plus and up), and money in and out needs Pro. The Sharmas are on
  Family Plus and Arora Electric on Pro, so every screen shown is one they
  would see.
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
  extractor would store none. The policy callout leaves out the insured's name
  on purpose: the name pattern carries on across the line break.
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
  She asks in one business, because a CA is in her clients' businesses too.
- **The voice languages** are the list in `src/lib/voice-languages.ts`:
  English (India), Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada,
  Malayalam and Punjabi. Whether a phone can speak a language depends on the
  voices it has, which the line under the cards says.
- **The spoken answer is what the app would say.** It is the answer on the
  screen as `toSpeech()` (`src/lib/speech-text.ts`) hands it to the phone's
  voice: the policy number spelled out, in groups of four ("A S H 2, 3 1 1 4,
  5 8 9"). The letters are written as a Hindi voice says them (ए एस एच),
  because espeak would read a lone "A" as the English article. The app reads
  with the phone's own voices, so on a real phone the voice will differ; the
  film's is a stand-in for one.
- **The family has 4 members** (Family Plus allows 8); Dadi, Neha and Aarav
  are in the tree without accounts, which the tree allows. **Arora Electric
  has 3 of Pro's 15**, and the CA's invitation holds a place until she answers.
- **The end cards' prices** are `PLUS_PRICE` (Family Plus, ₹100 a month) and
  `BUSINESS_PRICE` (from ₹500 a month, plus GST) in
  `supabase/functions/_shared/plan-text.ts`. A business plan is set up by hand
  ("Ask us"), and business vaults are a pilot for a few businesses, so check
  what the app offers before publishing either film.
- **Ask's category chips** are the vault's own kind in each film: family
  categories for the Sharmas, a business's for Arora Electric. The app lists
  the first eight categories of every kind there (`fetchCategories` does not
  filter by audience), so today a family sees Business Insurance among them and
  a business sees Birth Certificate, until that is fixed; the films show what
  it should.

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
voices are generated by Kokoro-82M, whose model and voices are Apache 2.0; no
recording or voice actor is involved.
