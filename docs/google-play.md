# Google Play: AskLocker's listing, and the forms Play Console asks for

What to type into Play Console for the Android app (`com.asklocker.app`), worked
out from the code on 14 November 2026. Keep it true of the app: when what the
app collects, sends or offers changes, change this file and the privacy policy
(`policy` in `site/content.mjs`) together, then update the forms in Play
Console. The copy follows CLAUDE.md's rules: plain words, no "secure", "safe",
"private and isolated", "100% private", "only you can see it" or "nothing is
kept", and nothing about prices or buying, since the Android app takes no
payments.

## Store listing (Grow › Store presence › Main store listing)

| Field | Value |
|---|---|
| App name | AskLocker |
| Short description (80 at most; this is 61) | Family documents in one place. Ask about them in plain words. |
| App icon | `assets/store/icon-512.png` (512 × 512, a full square: Play rounds the corners) |
| Feature graphic | `assets/store/feature-graphic.png` (1024 × 500) |
| Category | Productivity |
| Tags | Productivity, Organizer (pick what Play offers closest) |
| Email | support@asklocker.com |
| Website | https://asklocker.com |
| Phone | Leave empty unless one is shown on asklocker.com/contact |
| Privacy policy | https://asklocker.com/privacy |

Both images are drawn by `node site/tools/play-feature-graphic.mjs`, from the
landing page's headline and the app's icon: run it again after changing either.

### Full description (under 4,000 characters)

```
AskLocker keeps your family's documents in one place, and answers questions about them.

Add a passport, an insurance policy, a bill or a certificate with your camera, from your gallery, or as a PDF or spreadsheet. Then ask in your own words:
• When does Mom's passport expire?
• What's the sum insured on our health policy?
• Which bank is my FD with?
Each answer shows the document it came from, so you can check it.

Made for families
• A family vault that everyone in your family can open, and a personal vault that's yours alone.
• A family tree, so "my mother's passport" finds the right document.
• Emergency cards: blood group, allergies, medicines and who to call.
• A reminder before a passport, licence or policy runs out.

For small businesses too
• A business vault for invoices, bills, licences and contracts, shared with your team.

Who can open your documents
In AskLocker, only people in your vault can open your documents, and anyone you send a share link. Documents are encrypted, but not end-to-end: our servers read them to search and answer, and parts of them go to AI services to write answers. Details: asklocker.com/privacy

Good to know
• Answers are written by AI and can be wrong. Check the document before you rely on one.
• AskLocker isn't a backup. Keep the originals.
• Sign in with Google. The same account works on asklocker.com.
```

Left out on purpose, until the Android app does them: asking by voice (the
microphone needs `expo-speech-recognition` in the phone app; answers read
aloud already work), making share links (web only), reading photos in Indian
languages (the Android app reads photos in English only), Gmail import (web
only), and every plan and price (the app takes no payments). Add a line when
the app gains one.

### Screenshots (phone: 2 to 8, PNG or JPEG, 9:16, each side 320 to 3,840 px)

Take them on a phone with the production app, signed in to an account made
for this, holding only the fictional SPECIMEN documents from `qa/fixtures/`
(never a real document: this repo is public, and so is the listing). A DEV
build shows the DEV badge, so not from one. In this order:

1. Home, with a few documents and the three counts.
2. Ask, with a question ("When does Asha's passport expire?") and its answer and source.
3. Upload, showing Scan, Gallery and Browse Files, and "Where should this go?".
4. A document's page with its expiry date.
5. The family tree.
6. An emergency card (fictional details).
7. Notifications, with an expiry reminder.
8. Optional: Settings › Your vaults, with a family and a business.

## App content (Policy › App content)

| Form | Answer |
|---|---|
| Privacy policy | https://asklocker.com/privacy |
| Ads | No, the app contains no ads |
| App access | All or some functionality is restricted. Instructions: "Sign in with any Google account. The first sign-in makes the account; nothing else is needed. To see a family vault, create one from Settings › Your vaults." |
| Content rating | See below |
| Target audience | 18 and over only. Not designed for children, and the listing doesn't appeal to them |
| News app | No |
| Government app | No |
| Financial features | None (the app holds documents; it gives no loans, payments or financial advice) |
| Health apps | The app keeps an emergency card per person (blood group, allergies, conditions, medicines, doctor). Declare the closest option Play lists for personal health or medical records, and that the app does not diagnose or treat anything. Owner to check the options on the form |
| Data safety | See below |
| Account deletion | Web link: https://asklocker.com/privacy#your-choices (it says how: Settings › Security › Delete account in the app, asklocker.com/settings/delete-account, or by email). In the app: Settings › Security › Delete account |

### Content rating (the IARC questionnaire)

Category: All other app types (Utility, Productivity, Communication or other).

- Violence, sexual content, bad language, drugs, alcohol, tobacco, gambling: No.
- Do users interact or exchange content? Yes: people in a vault see each other's documents, and a document can be shared by link. Nothing is public.
- Does the app share the user's current location with others? No.
- Does the app allow buying digital goods? No.
- Is it a web browser or search engine? No.

Expected result: rated for everyone, with "Users Interact".

### Data safety

Every item below is processed by service providers acting for AskLocker
(Supabase, Cloudflare, Anthropic, Groq, OCR.space, Google, and the usage
analytics service), which Play does not count as sharing. So the answer to
"shared" is No throughout. Data is encrypted in transit (HTTPS) everywhere.
Users can ask for their data to be deleted (Settings › Security › Delete
account, or by email). Not committed to Play's Families policy; no
independent security review.

| Play's data type | Collected | Required or optional | Why |
|---|---|---|---|
| Personal info › Name | Yes | Required (from Google) | App functionality, Account management |
| Personal info › Email address | Yes | Required (from Google) | App functionality, Account management |
| Personal info › User IDs | Yes (the account's id) | Required | App functionality, Account management |
| Personal info › Phone number | Yes | Optional (Settings › Profile) | App functionality |
| Health and fitness › Health info | Yes (emergency cards) | Optional | App functionality |
| Photos and videos › Photos | Yes (photos added as documents) | Optional | App functionality |
| Files and docs | Yes (documents added) | Optional | App functionality |
| App activity › Other user-generated content | Yes (questions, saved chats, notes, family tree) | Optional | App functionality |
| App activity › App interactions | Yes (usage counts: screens and buttons, document categories) | Optional (Settings › Privacy › Share app usage) | Analytics |
| Device or other IDs | Yes (a random number per install for usage counts; a notification token per device) | Optional | Analytics, App functionality |

Not collected by the Android app: location (precise or approximate), contacts,
calendar, messages (SMS or email), audio, video, web history, other apps,
purchase history and payment details (the app takes no payments; payments
on asklocker.com go to Razorpay), crash logs and diagnostics.

Check before submitting, since each depends on code still changing:

- Usage counts run only in production builds (`src/lib/analytics.ts`, from
  the Supabase address), so the Play build does send them.
- If the Android app gains voice questions, the phone's own speech service
  hears them; say whether audio reaches AskLocker (it should not).
- If notifications go through Expo's push service on their way to Google's
  Firebase Cloud Messaging, name Expo in the privacy policy's Push services row.

## First release

| | |
|---|---|
| App or game | App |
| Free or paid | Free (no in-app products) |
| Countries | India first; add others when they are wanted |
| Release notes | First release of AskLocker for Android. |

A personal Play developer account made after 13 November 2023 must run a
closed test with at least 12 testers, opted in for 14 days in a row, before it
can apply for production access. An organisation account is exempt.
