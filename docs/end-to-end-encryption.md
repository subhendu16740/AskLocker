# End-to-end encryption — the plan

**Status: planned. Phase 0 is done (it works on a real phone); nothing is encrypted yet.**
Until Phase 5 is done, every screen, the privacy policy and the agreement
keep saying documents are **not** end-to-end encrypted, and the marketing
videos stay unpublished (CLAUDE.md, "Never promise more privacy than
AskLocker gives").

The goal, in the owner's words (3 November 2026): nobody in the middle,
inside AskLocker or outside it, can open a family's documents or
emergency cards. Only the people in the vault can.

---

## What it will mean

**After it ships, nobody at AskLocker can open:**

- documents, their names, the text read from them and their passages
- the details found in them (expiry dates, ID numbers, amounts)
- vault names, the family tree, nicknames and emergency cards
- saved chats and notes
- the search index (vectors and keywords), which says what a document is
  about as surely as its text does

**AskLocker can still see** what it needs to run the service, and nothing
else:

- accounts: the email someone signs in with, and who is in which vault,
  as what role
- counts, sizes and times: how many documents, how big, when added, by whom
- each document's **built-in category** (Passport, PAN Card…), never a
  family's own category name. The owner's one exception (3 November 2026):
  counted across everyone for marketing, never per family
  (`supabase/queries/document-categories.sql` already works this way)
- plans, payments and the counts that keep limits (questions, uploads)

**One thing passes through:** to answer a question, the phone sends the
few passages it needs, and the question, to the AI service (Claude or
Groq) through AskLocker's server, which passes them on and keeps nothing.
That is a promise about how the server is written, not something the
encryption guarantees, so the words say exactly that. Without it nothing
could answer a question. (Stronger options exist, like Apple's Private
Cloud Compute and WhatsApp's Private Processing; neither is available to
an app this size today.)

---

## How it works

Standard pieces only, all WebCrypto, nothing home-made
(`supabase/functions/_shared/vault-crypto.ts`):

| Piece | What it is |
|---|---|
| Sealing | AES-256-GCM, a fresh random 96-bit nonce every time, and a context string as associated data |
| Locking a key for a person | ECDH P-256 with a fresh ephemeral key, then HKDF-SHA-256 |
| Signatures | ECDSA P-256 with SHA-256 |
| Recovery Key | 128 random bits, 28 characters in 7 groups of 4 (Crockford base32, the last two a checksum) |

**Layers** (envelope encryption, as in Google Workspace's client-side
encryption, Proton Drive and Apple's Advanced Data Protection):

```
file key (one per document)   seals the file, its name, its passages, its details
   ↑ locked by
vault key (one per vault)     also seals the vault's name, tree, cards, chats, notes
   ↑ locked for each member
member's identity key         kept on their devices
   ↑ backed up by
their Recovery Key            which only they hold
```

**Every sealed item is bound to its place.** The context names the vault,
the document and the kind of data (`asklocker/v1/document/passages/<vault>/<document>`),
so a server cannot move a file into another document or vault, swap two
files, or pass passages off as a name, without the phone refusing it. A
vault key locked for Asha opens only as Asha's, in that vault, at that
key version; her Recovery Key backup opens only as hers.

**Formats** (each starts with its version, so a later change can be told
apart): sealed text `e1.…`, a sealed file starts with the bytes `AL 01`,
a vault key locked for a member `g1.…`, an identity backup `r1.…`.

**Keys stay on devices.** A device keeps its identity in IndexedDB as a
key the browser will not hand out (`deviceCopy()`), and asks the browser
to keep its storage for good (`navigator.storage.persist()`). No Edge
Function imports `vault-crypto.ts`; the self-test fails if one does.

---

## Decisions

The owner's, 3 November 2026.

### Joining is automatic

An admin invites, the person says yes, and they are in: nobody confirms
anything else. Behind it:

1. The invitation is **signed** by the admin's identity key, naming the
   vault, the email and the role.
2. The person signs in, their app makes their identity if it has none,
   and they accept.
3. The next app of someone in the vault to open (usually the admin's)
   checks the acceptance answers that signed invitation and locks the
   vault key for the new member, without a tap. Until then the new member
   sees "Waiting for someone in your family to open AskLocker".
4. **Background checks, never questions:** each member's app checks that
   the public key the server lists for them is their own; every member
   sees "Ravi joined", and "Ravi's key changed (new phone)" when it does,
   as WhatsApp shows a changed security code.

**The honest limit:** a server that lies could add a key of its own at the
moment someone joins. Signed invitations and visible joins make that loud,
not impossible. The outside review looks at this first (the ETH Zurich
study of five encrypted cloud services, 2024, found key authenticity the
usual weak point), and key transparency can come later.

**Leaving or being removed** makes a new vault key (the next version) for
everyone else. What the person already opened, they keep: no encryption
can take back what someone has seen.

### Nothing readable but the categories

Above. A family's own category name is sealed; the server keeps the
built-in category's id, or none.

### Reminders: fully private (option A)

The server cannot know an expiry date, so it cannot send expiry or
birthday reminders. Instead:

- the app works out what is due each time it opens (Home, Reminders);
- the phone app, once EAS builds exist, schedules the notifications on
  the phone itself;
- invitations, plan notices and other notices about the service still
  reach devices, since the server already knows them.

So "expiry reminders for everyone" on Family Plus becomes reminders in
the app (and on phones with the phone app). The Plans page, Help and the
Plus words change with it, in Phase 3.

### Recovery

What families lose a phone to is the usual case, so most of recovery is
free: everyone in a vault holds its key, so a member who loses everything
is simply let back in (the joining flow above) and gets every family
vault back. Only what is theirs alone, their **personal vault**, saved
chats and notes, needs their own key back. Three ways, as Apple's
Advanced Data Protection offers:

1. **Approve from another device** that is signed in (a code on one, a
   tap on the other).
2. **The Recovery Key**, shown once at setup, to write down or save in a
   password manager.
3. **A recovery contact** (optional): someone in the family whose app can
   help unlock theirs, after a code passed between them.

On phones whose passkeys give a key (WebAuthn PRF; Phase 0 measures
which), the fingerprint unlocks the identity too, so most people never
type the Recovery Key.

Lose every device, the Recovery Key and every helper, and the personal
vault cannot be opened, by anyone. Setup says so in one plain line.

### Support

Staff cannot see documents, so support works the way Proton's and
Tresorit's does: from what the server already knows (accounts, sizes,
times, errors), from the person's own screen, and from a report the
person chooses to send, which carries no document content.

---

## What changes

| Today | After |
|---|---|
| The server reads files (`ingest-document`): PDF text, OCR.space for scans | The phone reads them: text, photos and scanned pages with Tesseract, spreadsheets as now |
| The server makes search vectors (gte-small, Cloudflare) | The phone makes them: the same gte-small, in the browser (transformers.js) |
| Search runs in the database (`rag_retrieve_chunks`) | The phone downloads the vault's sealed index, opens it and searches it |
| rag-search searches, judges and answers | The phone searches; rag-search judges and answers from the passages the phone sends, and keeps nothing |
| Relations ("Nani's pension") resolved on the server | Resolved on the phone, from the tree it opened (`kinship.ts` already runs in the app) |
| Expiry and birthday reminders pushed by the server | Worked out in the app; scheduled on the phone by the phone app |
| A share link opens a signed address to the file | The link carries the file key after `#`; the page opens the file in the browser |
| The business overview reads details in the database | The phone works it out from the details it opened |
| Gmail import | Off until rebuilt on the phone (it reads mail on the server) |
| `reembed-index`, server OCR and the PDF reader | Removed once every vault is moved |

Unchanged: plans, limits (they count sizes and numbers), payments,
invitations, deleting an account or a vault, the 30-day removal after
Plus ends (it picks documents by size and date).

---

## Phases

About 12 to 14 weeks in all.

| Phase | What | Weeks |
|---|---|---|
| **0** | The crypto core and its self-tests; the lab page that measures a real phone; this plan. Done 3 November 2026: it works on a phone (above) | 1 (done) |
| **1** | Keys and devices: making an identity, the Recovery Key screen, keeping keys on the device, a new device by approval, by Recovery Key or by fingerprint; tables for public keys, backups and locked vault keys. Nothing encrypted yet | 3 |
| **2** | New documents sealed, behind a per-vault switch on DEV: reading, splitting, vectors and details on the phone; the sealed index and search on the phone; Ask from the passages it sends; the viewer and share links | 3–4 |
| **3** | Everything else sealed: vault names, tree, cards, chats, notes; reminders in the app; the business overview on the phone; joining and leaving with new vault keys | 2 |
| **4** | Moving existing vaults: the first admin's app to open locks each document and its index ("Locking your documents… 12 of 30"), then the server deletes what it had. Gmail import off; the content-reading functions removed; the privacy policy, a new agreement version, Help | 2 |
| **5** | An outside security review of the code and the key flows, fixes, and only then the claim and the videos | 2 + the reviewer's time |

**The claim, once Phase 5 is done**, and not a word before:

> End-to-end encrypted. Your documents are locked on your family's
> devices, and nobody at AskLocker can open them. To answer a question,
> your phone sends only the passages it needs to an AI service; our
> server passes them on and keeps nothing.

Never: "100% private", "unhackable", "zero-knowledge" (the AI service
reads passages), "military-grade", "bank-level", "nobody can ever see".

---

## Phase 0: what is measured

**`/lab/e2e.html`**, on DEV builds only (`public/lab/`; `scripts/lab-pages.mjs`
deletes it from every build that does not name the DEV project, and gives
DEV's a `vault-crypto.js` made from the real `.ts` by Node). It reads
nothing of AskLocker's, sends nothing, and downloads only the search
library (transformers.js 4.3.1, from jsDelivr) and model (from Hugging
Face). Open `https://dev.asklocker.pages.dev/lab/e2e.html`, run each
section, tap Copy results.

1. **Locking and unlocking** with the real code: identities, a vault key
   locked for a member, a 5 MB file, 100 passages, the Recovery Key backup.
2. **Keeping a key** in IndexedDB that the browser will not hand out.
3. **Search on the device**: gte-small (q8, 34.7 MB once), a full passage,
   ten at once, a question, and whether the right document comes first.
   One thread by default; "Try several threads" reloads with
   `?threads=4` (the lab pages are cross-origin isolated for that).
   **3b** tries the graphics chip (WebGPU, a 36 MB q4f16 model).
4. **A key from the fingerprint** (WebAuthn PRF): with the AskLocker
   passkey on DEV's address, or a test passkey to delete afterwards.

**Results, 3 November 2026**, on the owner's Android phone (8 cores,
8 GB, Qualcomm Adreno 7xx graphics, Chrome 155) at
`dev.asklocker.pages.dev`, with a headless test computer (4 cores) beside
it:

| | Phone | Test computer |
|---|---|---|
| A member's keys made | 1.8 ms | 0.5 ms |
| Locking a vault key for a member / opening it | 0.7 ms / 0.3 ms | 0.3 ms / 0.3 ms |
| A 5 MB file locked / opened | 16 ms / 12 ms (320 MB/s) | 22 ms / 15 ms |
| 100 passages locked / opened | 13 ms / 9 ms | 17 ms / 8 ms |
| Recovery Key backup / restore | 0.9 ms / 0.9 ms | 2 ms / 1 ms |
| Key kept in IndexedDB, unreadable, still works | yes | yes |
| Storage kept for good without asking | no | no |
| Search model, first time / from cache | 7.5 s (34.7 MB) / 1.2 s | 2.2 s from cache |
| A full passage (320 tokens), one thread | 0.92 s | about 0.65 s |
| A full passage, four threads | 0.47 s | hung |
| A question | 25 ms (one thread), 18 ms (four) | about 20 ms |
| Right document first | 4 of 4 | 4 of 4 |
| Graphics chip (WebGPU, q4f16) | loaded in 12 s, 3.7 s for one short passage, then the chip was lost ("Device is lost") | no chip offered |
| A key from a passkey (PRF) | yes, from a passkey made with PRF asked for | yes (virtual authenticator) |
| The AskLocker passkey on this address | no passkey for it on the phone | not tried |

**Concluded (the owner agreed, 3 November 2026): the plan goes ahead.**

- **The encryption costs nothing a person would notice.** Every lock and
  unlock is a few milliseconds, a 5 MB file included.
- **Keys can stay on the phone.** The browser keeps them in a form it will
  not hand out, and they still work after the page is opened again.
- **Search on the phone works.** A question takes about 20 ms and found
  the right document every time. Reading is the slow part: about 1 s a
  passage on one thread, so a bill or an ID card (one to five passages)
  takes seconds and a 100-passage tax return about a minute and a half,
  read in the background with progress. Moving a vault of 30 documents
  takes a few minutes, once. The model is 35 MB, fetched once, so the app
  fetches it on Wi-Fi where it can, and says so on mobile data.
- **Four threads halve the reading time**, but only on a cross-origin
  isolated page, and isolating the app's pages may break Google's sign-in
  window and Razorpay's checkout (why only `/lab/*` is isolated now).
  Phase 2 tests a way to isolate without that (Chrome's
  `Document-Isolation-Policy`, or isolating only the screens that read).
  Without it, one thread is the speed, and that is acceptable.
- **The graphics chip is not used.** It loaded, read one passage slowly,
  then failed. Not worth a code path that breaks on a common phone.
- **A fingerprint can give a key** (WebAuthn PRF), so a fingerprint can
  unlock the identity on a new device and most people never type their
  Recovery Key. Phase 1 checks whether the passkey Supabase makes for
  fingerprint sign-in can be asked for PRF, or each person needs a second
  passkey for unlocking.
- **The browser does not keep storage for good by itself.** Phase 1 asks
  for it (`navigator.storage.persist()`), and the Recovery Key or another
  device covers a browser that clears it anyway.
- **Not yet measured: an iPhone.** Safari can differ on threads, storage
  and PRF. One run of the lab on any iPhone settles it, before Phase 2.

---

## Limits that stay true

Said plainly, in the plan and later in the privacy policy:

- **The web app's code comes from AskLocker's server.** A server that
  was broken into could send code that leaks keys; this is true of every
  encrypted web app (Proton's and Tresorit's included). The phone apps,
  signed by the stores, narrow it.
- **Joining**: above. Signed invitations and visible joins, not proof.
- **The AI service reads the passages an answer is written from.**
- **What the server sees**: accounts, membership, sizes, times, counts,
  built-in categories.
- **A lost personal vault is lost**, with every device, the Recovery Key
  and every helper gone.
- **A browser can clear its storage**; the app asks it not to, and the
  Recovery Key or another device brings the key back.

## Outside review

Before the claim: a review of `vault-crypto.ts`, the key flows (joining,
leaving, new devices, recovery) and the web app's delivery, by a firm
that does this work. The cost is a quote to ask for once Phase 3 is
written; the claim waits for it.
