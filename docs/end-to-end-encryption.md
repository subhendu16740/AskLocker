# End-to-end encryption — the plan

**Status: Phases 0 to 4 are built, in test builds only, vault by vault
(Phase 3 on 8 November 2026); nothing on asklocker.com is locked.** Until
the outside review (Phase 5) is done, every screen, the privacy policy and
the agreement keep saying documents are **not** end-to-end encrypted, and
the marketing videos stay unpublished (CLAUDE.md, "Never promise more
privacy than AskLocker gives").

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
| Backup key (the Recovery Key) | 128 random bits, 28 characters in 7 groups of 4 (Crockford base32, the last two a checksum) |
| A key from the phone's lock | WebAuthn PRF, through HKDF-SHA-256 |

**Layers** (envelope encryption, as in Google Workspace's client-side
encryption, Proton Drive and Apple's Advanced Data Protection):

```
file key (one per document)   seals the file, its name, its passages, its details
   ↑ locked by
vault key (one per vault)     also seals the vault's name, tree, cards, chats, notes
   ↑ locked for each member
member's identity key         kept on their devices
   ↑ brought to a new device by
the phone's lock (a passkey), another signed-in device, or the backup key
```

**Every sealed item is bound to its place.** The context names the vault,
the document and the kind of data (`asklocker/v1/document/passages/<vault>/<document>`),
so a server cannot move a file into another document or vault, swap two
files, or pass passages off as a name, without the phone refusing it. A
vault key locked for Asha opens only as Asha's, in that vault, at that
key version; her Recovery Key backup opens only as hers.

**Formats** (each starts with its version, so a later change can be told
apart): sealed text `e1.…`, a sealed file starts with the bytes `AL 01`,
a vault key locked for a member `g1.…`, an identity backup `r1.…`,
anything locked for one public key `l1.…`.

**Keys stay on devices.** A device keeps its identity in IndexedDB as a
key the browser will not hand out (`deviceCopy()`), and asks the browser
to keep its storage for good (`navigator.storage.persist()`). No Edge
Function imports `vault-crypto.ts`; the self-test fails if one does.

---

## Decisions

The owner's, 3 and 4 November 2026.

- **The goal is the owner's, not a word:** only the people in a vault can
  read its documents. The AI service reads the passages an answer is
  written from; nobody at AskLocker reads anything.
- **Nobody is asked to remember anything.** The phone's own lock
  (fingerprint, face, PIN or pattern) is the everyday way back; a backup key
  is offered once and can be skipped (4 November: "we cannot put the user
  to enable or memorize so many things").
- **Joining is automatic.** An admin invites, the person says yes, and they
  are in.
- **Nothing readable but the categories**: each document's built-in
  category is counted across everyone for marketing, never per family.
- **Reminders are worked out in the app** (option A).
- **Gmail import moves onto the phone** (4 November), so it keeps working.
- **It is turned on vault by vault**, by the vault's owner, in test builds
  only, on a project that allows it (`e2e_config.locking_allowed`, false on
  PROD). A vault that is not locked works exactly as before.

---

## The design, as built

### A person's keys

1. **Made on the device, without a screen.** The first time someone opens
   Settings › Security › Encryption keys in a test build (later: the first
   sign-in), the app makes their identity: an ECDH key (others lock vault
   keys for it) and an ECDSA key (they sign with it). The public halves
   and their fingerprint go to `user_keys` (070).
2. **Kept on the device** in IndexedDB (`asklocker-keys`): the identity
   itself as keys the browser will not hand out, for every day, and a copy
   sealed with a device key the browser will not hand out either, so this
   device can lock the identity for a new phone, a passkey or a new backup
   key. A script can use them while the page is open; it cannot copy them
   out.
3. **Back on a new device, three ways, any one enough:**
   - **The phone's lock** (a passkey that gives a key, WebAuthn PRF). Made
     with one fingerprint or PIN; Google Password Manager and iCloud
     Keychain carry it to the person's other phones. Its output never
     leaves the device; HKDF of it seals the identity (`key_unlocks`, 071).
     The passkey is AskLocker's own, named "AskLocker documents key", not
     the one fingerprint sign-in uses.
   - **Approving from a device already signed in.** The new device makes a
     one-time key pair and shows a six-digit code made from its public key;
     the signed-in device shows the same code beside "Approve"; the identity
     is locked for that public key (`key_device_requests`, 071). A server
     that swapped the key would change the code.
   - **The backup key**, offered once with Save (copy, download, print) or
     Skip (`user_keys.backup`, optional since 071).
4. **Lost every way back** (every device, the passkey and the backup key):
   the person makes new keys (`replace_my_identity`, 071). Every family
   vault comes back once one of its admins approves "Asha set up a new
   phone"; their personal vault does not.

### A vault's key

- **One per vault and key version** (`vault_keys`), locked for each member
  with their public key (`vault_key_grants`, `g1.…`). Members read only
  their own grants.
- **Locking a vault** (`lock_vault`, the owner): version 1, locked for the
  owner, then for every member as their apps meet it.
- **Joining:** whenever a member's app opens a locked vault it locks the
  key for any member who has none (`vault_key_members`, `grant_vault_key`).
  No tap. Someone whose keys **changed** since their last grant is locked
  for only by an admin, after "Approve" (`needs_approval`): that stops a
  server from slipping its own key in as a member's new phone.
- **Leaving or being removed:** the next admin app to open the vault makes
  the next version and locks it for everyone left; new documents use it.
  What someone already opened, they keep.

### A locked document

The phone does what the server used to:

1. **Reads it**: photos with Tesseract (as Upload always has), PDFs with
   PDF.js in the browser (`_shared/pdf-layout.ts`, the same layout rules
   as the server's), scanned PDF pages drawn and read with Tesseract,
   spreadsheets as since 061.
2. **Splits it** (`_shared/chunking.ts`), **finds its details**
   (`_shared/metadata.ts`: expiry dates, ID numbers, amounts) and **makes
   its search vectors** on the phone (gte-small with transformers.js, the
   model the lab measured; 8-bit vectors, 384 bytes each).
3. **Seals it** with a new file key: the file (with its name and type in a
   sealed header, so whoever opens it knows what it is), its details
   (`name`, the details found, its own category name), and its passages
   with their vectors. The file key is locked with the vault key.
4. **Saves it**: the sealed file to Storage (`<vault>/<id>.al`, so no
   server reader takes it for a PDF), then `insert_sealed_document` (071),
   which keeps every check `insert_family_document` makes (the folder, the
   file, the day's limit) and stores the sealed parts in `sealed_documents`.
   The row says "Locked document"; its status is `sealed`, which no server
   reader touches (`start_document_read`, `rag_documents_to_ingest`, 071).

Lists, the viewer, downloads, the person's page and Reminders open the
names and details on the phone. Deleting is as before; the sealed row
goes too (`sealed_documents_sweep`).

### Search and Ask

- The phone fetches the vault's sealed passages once a visit, opens them
  and keeps them in memory.
- A question: the phone makes its vector (about 20 ms), ranks passages 0.7
  by meaning and 0.3 by words, at most 4 from a document, and sends the
  best 15 with the question to rag-search (`client_passages`). rag-search
  checks the asker is in each vault, judges and answers from them with the
  documents it found itself in vaults that are not locked, counts the
  question as before, and keeps nothing.

### Share links

The link carries what opens the file after `#`, which browsers never send:
`/s#<secret>~<vault>~<document>~<file key>`. The page sends the secret to
`share` as before, downloads the sealed file and opens it in the browser.

### Reminders

The app reads expiry dates from the details it opened (Reminders, Home).
The server cannot know them, so it sends no expiry reminder for a locked
document.

### Saved chats

A chat that holds an answer from a locked vault is sealed for its owner
(locked with their own public key) before it is saved. The vaults its
sources came from stay readable, so 069's rule (a chat goes when its owner
leaves a vault it quotes) still holds.

### Moving a vault's older documents

After locking, the owner's app moves each older document ("Locking your
documents… 12 of 30"): downloads it, takes its text from the server (it
was readable anyway), splits it, makes vectors, seals it, uploads the
sealed file and calls `seal_existing_document` (071), which points the row
at the sealed file, deletes the readable text, passages, details and
expiry alerts, and turns off the document's share links. The app then
deletes the readable file. Supabase's backups keep old copies up to 7 days.

### Gmail import

For a locked vault, import runs in the browser: Google gives the page a
Gmail permission for an hour (Google Identity Services), the page searches
Gmail with the same rules (`_shared/gmail-rules.ts`), and each ticked
attachment is read, sealed and saved like an upload. The server's
`gmail-import` refuses a locked vault. Needs `EXPO_PUBLIC_GMAIL_CLIENT_ID`
(the Gmail project's client id) and the page's address in that client's
Authorized JavaScript origins.

### A vault's name, family tree, emergency cards and notes (Phase 3, 073)

Each is sealed with the vault key, bound to its place
(`asklocker/v1/<kind>/<vault>/<record>`), and kept in `sealed_vault_items`:
the vault's name, its tree links (one record), each person's details (name,
gender, date of birth, nickname) and each person's emergency card. The
server keeps "Locked vault" and "Person" in their place, and the vault's
own notifications stop saying its old name. Notes stay in `scratch_notes`,
their text sealed (`n1.<key version>.<id>.<sealed>`), each still its
owner's alone by RLS; a reminder on one says "A note reminder".

- **Who may write is still the server's** (`seal_vault_item`,
  `add_sealed_person`, `delete_vault_item`, the caller from `auth.uid()`):
  an admin the name and the links, an admin or the person themselves their
  details and card (031's and 032's rule). **The tree's shape is the
  app's** (`src/lib/tree-rules.ts`, 031's rules and words: one link a pair,
  two parents at most, nobody their own ancestor), since the server cannot
  see the links.
- **A locked vault refuses readable copies** on every path: a readable
  name, person, link, card or note is refused by a trigger. A member's own
  entry, made with their membership, keeps their account name until their
  app seals it.
- **Moving them**: after locking, the owner's app seals the vault's name,
  its links, everyone's details and cards, and its own notes; every
  member's app seals its own entry, card and notes when it opens the vault
  (`moveVaultDetails()`, from `tendVault()`).
- **What the phone works out instead**: who a question names by relation
  ("Nani's pension", from the asker's place in the opened tree), the names
  on documents, the business overview (renewals, bills due, money in and
  out, from the documents it opens), and deleting a vault by its name (the
  real name is checked on the phone; the server checks the one it keeps).
- **Still readable**: who is a member, with what role; how many people the
  tree has; which bills were marked paid, and when (the activity log
  records it anyway); a note's reminder date. **Birthday reminders stop**
  for a locked vault: the server no longer knows anyone's birthday.

---

## What changes

| Today | In a locked vault |
|---|---|
| The server reads files (`ingest-document`): PDF text, OCR.space for scans | The phone reads them: text, photos and scanned pages with Tesseract, spreadsheets as now |
| The server makes search vectors (gte-small, Cloudflare) | The phone makes them: gte-small in the browser (transformers.js) |
| Search runs in the database (`rag_retrieve_chunks`) | The phone opens the vault's sealed passages and searches them |
| rag-search searches, judges and answers | The phone searches; rag-search judges and answers from the passages the phone sends, and keeps nothing |
| Expiry reminders pushed by the server | Worked out in the app |
| A share link opens a signed address to the file | The link carries the file key after `#`; the page opens the file in the browser |
| Gmail import on the server | In the browser |
| The business overview reads details in the database | The phone works it out from the documents it opens |
| The family tree, cards, notes and the vault's name are readable | Sealed with the vault key; the tree's rules kept on the phone |
| Relations in a question are resolved on the server | On the phone, from the opened tree |
| Birthday reminders pushed by the server | None for a locked vault |

Unchanged: plans, limits (they count sizes and numbers), payments,
invitations, deleting an account or a vault, the 30-day removal after
Plus ends (it picks documents by size and date).

---

## Phases

| Phase | What | State |
|---|---|---|
| **0** | The crypto core and its self-tests; the lab; this plan | Done 3 November 2026 |
| **1** | Keys and devices: identity, phone lock, approving a device, optional backup key, new keys after losing everything | Built 4 November 2026 (071), test builds only |
| **2** | Locked vaults: documents read, sealed and searched on the phone; Ask; viewer; share links; reminders in the app; saved chats | Built 4 November 2026, test builds only |
| **3** | Vault names, tree, cards and notes sealed; the business overview on the phone | Built 8 November 2026 (073), test builds only |
| **4** | Moving existing vaults, Gmail import on the phone | Built 4 November 2026, test builds only |
| **5** | An outside security review of the code and the key flows, fixes, and only then the claim and the videos | The brief for the firm is written (8 November 2026, [below](#outside-review-phase-5)); the review is not started |

**The claim, once Phase 5 is done**, and not a word before:

> Only the people in your vault can open your documents. Nobody at
> AskLocker can. To answer a question, your phone sends only the passages
> it needs to an AI service; our server passes them on and keeps nothing.

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

## Outside review (Phase 5)

The claim waits for this. What follows is the brief to send a firm, so it
can quote a fixed price. Cure53, Trail of Bits, NCC Group, Include Security
and Doyensec all review end-to-end encrypted web apps; ask two or three
for a quote. Give them read access to the repository (it is public) and
two test accounts on DEV. Never give them PROD access, a real document,
or a service role key.

### What we ask them to answer

1. Can anyone who is not in a vault read its documents, its name, its
   family tree, a person's details, an emergency card or a business's
   notes? Count the server's operator, a former member and another
   account with the public key.
2. Can a member with fewer rights do more than they should? For example,
   a viewer renaming the vault, changing the tree's links, editing
   someone else's card, or locking others out.
3. After someone leaves, is what is added next out of their reach?
4. Is the cryptography used correctly? Check the nonces, the associated
   data (can a sealed item be moved to another record, vault, kind or key
   version and still open?), key derivation, curves, signatures, the
   six-digit device codes and the backup key's strength.
5. How far can an operator who changes the server's answers get? For
   example, by adding a member with its own key, swapping a public key or
   sending older code. What would a member notice?

### In scope (about 5,900 lines)

| What | Files |
|---|---|
| The crypto core | `supabase/functions/_shared/vault-crypto.ts` (604 lines; self-tests in `qa/tools/selftest.mjs`) |
| A person's keys: made on the device, the phone's lock (passkey PRF), approving a device, the backup key, new keys | `src/lib/vault-keys.web.ts`, `vault-keys-types.ts`, `src/app/settings/encryption.tsx` |
| Vault keys, grants, rotation; sealing and opening documents, names, the tree, cards, notes; search; share links; moving older documents | `src/lib/vault-lock.web.ts`, `e2e-api.ts`, `tree-rules.ts`, `local-search.ts`, `src/app/lock-vault.tsx` |
| The database's rules: who may write what, and readable copies refused | `supabase/migrations/070_user_keys.sql`, `071_locked_vaults.sql`, `072_locked_vaults_caller_first.sql`, `073_locked_vault_details.sql` |
| Reading on the phone; Gmail in the browser | `on-device-reader.web.ts`, `on-device-model.web.ts`, `gmail-device.web.ts` |
| The passages a question sends; share links | `supabase/functions/rag-search/index.ts` (`client_passages`), `supabase/functions/share/index.ts`, `src/app/s.tsx` |
| How the web app is served | `public/_headers`, Cloudflare Pages; scripts loaded from jsDelivr (PDF.js, transformers.js, Tesseract) |

The design is in [The design, as built](#the-design-as-built). The
database's rules are summed up in CLAUDE.md, point 3 at the top and
"Locked vaults".

### Known, and not findings

These are known and accepted. They are listed in
[Limits that stay true](#limits-that-stay-true) and under Phase 3.

- The server sees accounts, who is in which vault and their roles,
  sizes, times, counts and built-in categories. It also sees how many
  people a tree has, which bills were marked paid and when, and a note's
  reminder date.
- The AI service reads the passages an answer is written from.
- The web app's code comes from AskLocker's server.
- Joining is automatic, without proof.
- A lost personal vault is lost.
- Locking is only in test builds, and only where
  `e2e_config.locking_allowed` is true. The phone app is not built yet.

We still want to hear if any of these is worse than we think.

### What we want back

- A report: each finding with how serious it is, where it is, how to
  reproduce it and a fix.
- A second look at our fixes. Then a short letter that we may quote, or
  a summary we may publish, saying what was reviewed and when.

### Before sending it

- Apply 073 to DEV, and run QA once with every 070–073 probe passing.
- Fix what our own review found. It is not committed, since the
  repository is public.
- Freeze the files above on a branch for the review. Changes made after
  it need the firm's second look before the claim.
