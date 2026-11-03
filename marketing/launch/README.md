# The launch set: do not post until end-to-end encryption ships

> **Embargoed.** Everything in this folder says what AskLocker will do once
> end-to-end encryption ships: documents locked on the family's own phones,
> nobody at AskLocker able to open them. That is **planned, not live**
> (target around February 2027, a target, not a promise). Until the owner
> confirms it has shipped, nothing here is posted, scheduled, shown to a
> customer or sent to a partner, and no public post may say or suggest that
> documents are end-to-end encrypted. Use today's set (`../family`, `../nri`,
> `../business`) meanwhile. The earlier privacy film (`../privacy`) also
> stays unpublished, by the brief. Wording may change before launch: check
> the final lines with the owner just before release.
>
> The repository is public, so these files can be seen on GitHub now. They
> are clearly marked as the launch set; if they should stay private until
> launch, remove this folder from the repository and keep the files
> elsewhere.

Made from the encryption brief of 3 November 2026 (the marketing brief on
end-to-end encryption): its one line, **"Locked on your phone. Opened only
by your family."**, its three points (your family holds the key; it still
answers your questions; you stay in control of getting back in), its "Say"
lines and its six video ideas. Rendered from the same code as today's set,
with one switch (`--launch`, `src/claims.js` in `../video/`), so a change of
wording is made in one place and every video follows.

## What's here

| Folder | What | Shapes |
|---|---|---|
| `locked/films/` | **The launch film**: eight questions, each answered while a diagram or the phone shows it (adding a document, who can open it, asking a question, what AskLocker can see, a new phone, sending one paper, adding family, the emergency card) | 2:13 in [16:9](./locked/films/asklocker-locked-16x9-launch.mp4) and [9:16](./locked/films/asklocker-locked-9x16-launch.mp4) |
| `locked/reels/` | Six reels from it, the brief's six ideas (below) | 9:16, 15 to 22 seconds, with music, and `-sfx-only` without it |
| `locked/covers/` | Each one's cover: its headline, and what shows it | the reels' 1080x1920, the film's in both shapes |
| `family/films/`, `nri/films/`, `business/films/` | The three launch films of today's set, every cut | the same shapes as today's; the family and NRI films 8 to 10 seconds shorter without Gmail import (2:06 and 1:03), the business film the same length |
| `family/shorts/`, `business/shorts/` | Every feature short (17), ending on the launch line | 9:16, with and without music |
| `family/posters/`, `business/posters/` | The posters that change at launch: privacy and access, reminders, ask, share, the emergency card | 1:1 and 16:9; the other posters stay as they are in `../family/posters` and `../business/posters` |

**The six reels** (the brief's video ideas):

| Reel | Says | Shows |
|---|---|---|
| [The locker on your phone](./locked/reels/asklocker-locked-locker-9x16-launch.mp4) | It's locked on your phone before it leaves. | Maa's passport read and locked on the phone, scrambled on the way and on AskLocker's servers |
| [Who can open it?](./locked/reels/asklocker-locked-who-9x16-launch.mp4) | Your family holds the key. We don't. | Your vault and a link can; AskLocker's team and someone who breaks into our servers see scrambled copies; an AI service gets only the parts a question needs |
| [Asking without handing it over](./locked/reels/asklocker-locked-asking-9x16-launch.mp4) | Your phone finds the page. Only that part goes to the AI. | The question asked; phone, server (keeps nothing), an AI service; the answer |
| [Your key, your way back](./locked/reels/asklocker-locked-key-9x16-launch.mp4) | Your Recovery Key gets you back in. | The Recovery Key saved, Papa picked as recovery contact; a new phone unlocked with the key |
| [Adding family](./locked/reels/asklocker-locked-family-9x16-launch.mp4) | They tap Accept. They're in. | Priya accepts Rohan's invitation, and Sharma Family's documents are on her Home |
| [The emergency card](./locked/reels/asklocker-locked-emergency-9x16-launch.mp4) | Your family has it. Nobody else does. | Papa's emergency card, allergies first |

Every video ends on **"AskLocker. Ask your documents anything. Only your
family can open them."** (a business's: "Ask your records anything. Only
your team can open them.").

## What changed from today's set

- **The privacy lines** follow the brief, everywhere: the privacy scene of
  the family and NRI films, the business film's access and control, the
  privacy and access shorts and posters: locked on your phone, your family
  (team) holds the key, not even AskLocker, your way back, and "To answer a
  question, only the parts it needs go to an AI service. We don't keep
  them."
- **No Gmail import.** It is off for encrypted vaults until it is rebuilt to
  run in the browser, so the family and NRI films skip it (the next scene
  brings the phone in) and Upload shows no From Gmail.
- **Reminders in the app.** They are worked out on the phone and show on
  Home and in Reminders, not as web notifications, so the films and the
  reminders shorts show the Reminders page, never a lock-screen reminder.
- **Callouts**: Ask and its business twin say only the parts it needs go to
  an AI service; Share says the link carries that one file's key and the
  rest stays locked; the emergency card says only your family can open it.

## Every claim, and where it comes from

All from the brief. The launch film's sources are also listed in
`../video/src/locked-screens.js`.

| The videos say | The brief |
|---|---|
| Locked on your phone. Opened only by your family. | The one line |
| Documents are locked on your phone before they're uploaded; read on the phone, locked with a key for that file, and that key with the vault's | How it works, adding a document; "AES-256-GCM, one key per vault, one key per file" |
| AskLocker stores only scrambled copies; nobody on our servers can read them | Planned: "AskLocker stores only scrambled copies"; step 4 |
| Each vault has its own key; only the people in your vault have it | Say: "Each vault has its own key. Only the people in your vault have it." |
| Nobody at AskLocker can open your documents or emergency cards | Say, word for word |
| Someone who breaks into our servers sees scrambled copies, and no key | Video idea "Who can open it?" |
| The phone searches its own copy and picks the passages; the server passes the question and those parts on and keeps nothing; never the key | How it works, asking a question |
| To answer a question, only the parts it needs go to an AI service. We don't keep them. | Say, word for word |
| What AskLocker can and cannot see (the table) | The brief's table, rows shortened |
| Your Recovery Key, your other phone, or a family member you chose gets you back in; we can't recover your documents for you; support can help you sign in, never open your vault | A new phone; What changes for users |
| The link carries that one file's key; the rest of the vault stays locked | Sharing one document |
| They tap Accept and they're in; the app hands them the vault's key; no codes to check | Adding a family member |
| Reminders in the app, worked out on the phone | What changes for users |

**Never in these videos**, as the brief and CLAUDE.md say: "end-to-end
encrypted" (an open question below), "100% private", "military-grade",
"bank-level", "unhackable", "secure", "safe", "only you can see it",
"nothing is kept", "zero-knowledge", "AI never sees your documents", or
anything that says it is live.

## Check before release

- **The launch date**, and that the owner has confirmed it shipped.
- **The screens drawn from the brief**, which do not exist in the app yet:
  the Recovery Key screen, Unlock your vaults on a new phone, the Reminders
  page's launch wording ("They show on Home and here", no "Get them on this
  device"), and Home with an invitation card as a new member sees it. Each
  is in the app's style; redraw any that the shipped app shows differently
  (`../video/src/locked-screens.js`, `remindersScreen()` in
  `family-screens.js` and `business-screens.js`).
- **Lines that depend on how it is built**: that a follow-up question sends
  only the question and its passages (today a follow-up also sends the last
  few messages; if it still does, say so); that the server keeps nothing of
  a question; that birthdays show in Reminders; that note reminders are
  worked out on the phone too.
- **The brief's open questions**: may the videos say "end-to-end
  encrypted" (the brief recommends yes, only after an outside security
  review, and always with the AI line beside it)? Should they name the AI
  services (they say "an AI service"; the privacy policy names Claude by
  Anthropic and Groq)? Who checks the Hindi lines (none are made yet)?
- **The privacy policy** must say all of this on launch day, since every
  video sends people to it.
- **Prices and plans** on the end cards (Family Plus ₹99 a month) as for
  today's set.

## Making them again

From `../video/`, after any change to the words or the app:

```bash
LAUNCH=1 ./tools/films.sh      # the twelve film cuts, launch set
LAUNCH=1 ./tools/features.sh   # every feature short, and the posters that change
./tools/locked.sh              # the launch film, its six reels and their covers
./tools/publish.sh             # copies them here (and today's set to its folders)
```
