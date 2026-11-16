# Release guide: the steps only the owner can do

Every step here needs an account, a payment or a document only the owner
has. Each says where to click. Everything else is Claude's, and is listed
at the end. Secrets (tokens, keys, passwords) go only where a step says:
never in a chat, an email or this repository.

The launch checklist is the page Claude made on claude.ai, ticked as steps
are done; this file is the how.

## Why the order matters

The Android app's release date is set by Google Play, not by the code. A
personal Play developer account made after 13 November 2023 must run a
closed test with at least 12 testers, opted in for 14 days in a row, before
it can apply for production. Then Google reviews it, which can take up to a
week. So every day before the first test build reaches Play moves the
Android launch back a day. The website can launch sooner: it needs only
Razorpay's approval to take payments.

| When | What | Who |
|---|---|---|
| Day 1 | Play account (identity check takes days), Expo, sign-in address, Razorpay KYC, legal facts | Owner |
| Day 1 | Project ID into the app, first test build | Claude |
| Day 2 | Test build on the owner's phone; fixes; release to `main`; the Play build (.aab) | Both |
| Day 2–3 | Closed test on Play, 12 testers opted in | Owner |
| Day 3–5 | Website: payments on once Razorpay approves; Supabase Pro; last walk through PROD | Owner, then Claude checks |
| Day 17–24 | Android public: 14 days after the testers opt in, then Google's review | Owner |

## 1. Google Play developer account (start first: about 20 minutes, then days of checks)

1. Go to **play.google.com/console/signup** and sign in with the Google
   account that will own the app. Use one you will keep: moving an app to
   another account later is slow.
2. Choose **Yourself** (a personal account) or **An organization**. An
   organisation needs a D-U-N-S number, which can take weeks to get, but it
   is exempt from the 12 testers for 14 days. If you have no D-U-N-S number
   today, choose Yourself.
3. Pay the one-time US$25.
4. Verify your identity with a government ID, and your phone and contact
   email, as Play Console asks. A new personal account is also asked to
   install the **Play Console** app on an Android phone and sign in there.
5. Tell Claude which kind of account it is.

When the account is ready:

6. **All apps › Create app**.
   - App name: `AskLocker`
   - Default language: English (India), `en-IN`
   - App or game: App. Free or paid: Free.
   - Tick the declarations, then **Create app**.
7. The dashboard lists **Set up your app** tasks. The answers to every one
   (store listing, privacy policy, app access, ads, content rating, target
   audience, data safety, account deletion) are in `docs/google-play.md`,
   with the feature graphic and icon in `assets/store/`.

## 2. Expo (about 10 minutes)

1. **expo.dev › Sign up**; verify the email.
2. **Projects › Create project**. Name `AskLocker`, slug `asklocker` (all
   lowercase, exactly this), owner your own account.
3. Open the project and copy its **Project ID** (`1a2b3c4d-…`). Send it to
   Claude. It is not a secret.
4. Your picture (top right) › **Account settings › Access tokens › Create
   token**, named `GitHub Actions`. Copy it: it is shown once.
5. GitHub › **subhendu16740/AskLocker › Settings › Secrets and variables ›
   Actions › New repository secret**. Name `EXPO_TOKEN`, paste the token,
   **Add secret**.

## 3. Let the app sign in (about 2 minutes)

In Supabase, for **DEV** and then **PROD**: **Authentication › URL
Configuration › Redirect URLs › Add URL**, type `asklocker://**`, save.
Without it Google sign-in in the app opens and never comes back.

## 4. Razorpay KYC (start today: about 30 minutes, then a few working days)

1. Sign in at **dashboard.razorpay.com** and open **Account & Settings ›
   Business details** (or the activation form it shows you).
2. Fill in the business type, PAN, bank account and address, and upload what
   it asks for.
3. **Website**: `https://asklocker.com`. Razorpay checks that the site shows
   the prices and has the privacy, terms, refunds and contact pages; all are
   live (`/privacy`, `/terms`, `/refunds`, `/contact`). The contact page's
   postal address and Grievance Officer appear once Claude has them (step 5).
4. Submit, and answer any question Razorpay emails.

## 5. Legal facts for the site (5 minutes)

Send Claude:

- who runs AskLocker: your own name, or the business's legal name
- a postal address
- the city whose courts hear disputes
- the Grievance Officer's name (it can be you), and their email: for example
  `grievance@asklocker.com`, made in Cloudflare › asklocker.com › Email ›
  Email Routing › Routing rules › Create address, sent on to your Gmail
- whether the 7-day full refund and "replies within 2 working days" stand

## 6. Firebase, for notifications on Android (about 15 minutes; can wait a day)

1. **console.firebase.google.com › Create a project**, named `AskLocker`.
   Google Analytics is not needed.
2. **Add app › Android**. Package name `com.asklocker.app` (exactly),
   nickname `AskLocker`, no SHA-1. **Register app**, **Download
   google-services.json**, then skip the remaining steps.
3. expo.dev › the **asklocker** project › **Environment variables** › add:
   name `GOOGLE_SERVICES_JSON`, type **File**, visibility **Secret**,
   environments **preview** and **production**; upload the file.
4. Firebase › gear › **Project settings › Service accounts › Generate new
   private key**. This file is secret.
5. Supabase **DEV**, then **PROD** › **Edge Functions › Secrets** › add
   `FCM_SERVICE_ACCOUNT`, and paste the whole file as its value. Then delete
   the file, or keep it offline.
6. Firebase › **Project settings › Cloud Messaging**: "Firebase Cloud
   Messaging API (V1)" should say Enabled.

## 7. The first test build on your phone (once Claude says it is ready)

Expo emails a link. Open it **on your Android phone**, download, and allow
installing from your browser when Android asks. The app shows the test
badge: it uses DEV. Sign in with Google, add a photo, ask about it, open
Settings › Notifications, and tell Claude what looked wrong.

## 8. Closed test on Google Play (once the Play build exists)

1. Play Console › AskLocker › **Testing › Closed testing › Create track**
   (or use the one named Alpha).
2. **Testers › Create email list**, named `First testers`, with at least 12
   Gmail addresses of people with Android phones. Save.
3. **Releases › Create new release**. Upload the `.aab` from Expo's email.
   Release notes: `First release of AskLocker for Android.` **Next › Save ›
   Send for review**.
4. When Play approves it, copy the **opt-in link** and send it to the
   testers. Each opens it on their phone, taps **Become a tester**, installs
   AskLocker from Play, and keeps it installed for 14 days.
5. After 14 days in a row with 12 or more opted in: **Dashboard › Apply for
   production**, answer Google's questions about the test, then
   **Production › Create new release** with the same build.

## 9. Before selling plans (about 20 minutes)

**Supabase: DEV in its own organisation, PROD on Pro.**

1. In the Supabase dashboard, open the organisation menu › **New
   organization**, named `AskLocker DEV`, on the **Free** plan.
2. Open the **DEV** project › **Project Settings › General › Transfer
   project**, and choose `AskLocker DEV`. Its address and keys do not
   change, so nothing in the app, Cloudflare or GitHub needs changing.
3. Back in the original organisation (PROD's) › **Billing › Change plan ›
   Pro** ($25 a month).

**Claude answers on PROD.**

4. **console.anthropic.com › API keys › Create key**, named `AskLocker
   PROD`. Supabase **PROD › Edge Functions › Secrets** › add
   `ANTHROPIC_API_KEY` with it.
5. In the Claude Console's billing, keep **auto-reload off**, so spending
   stops at the month's credit and Groq takes over.

**Razorpay live (once KYC is approved).**

6. In Razorpay, switch to **Live mode**. **Account & Settings › API Keys ›
   Generate Key**. Copy the Key ID (`rzp_live_…`) and the Key Secret.
7. **Account & Settings › Webhooks › Add New Webhook**:
   - URL: `https://yrcmdixqgvmhqxejvlor.supabase.co/functions/v1/razorpay-webhook`
   - Secret: a long random password from your password manager
   - Active events: `payment.captured` and `order.paid`
8. Supabase **PROD › Edge Functions › Secrets** › add `RAZORPAY_KEY_ID`,
   `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` (the webhook's
   password). DEV keeps its test keys.
9. On asklocker.com, pay ₹99 for a month of Family Plus with your own card or
   UPI. Tell Claude: Claude checks the payment reached the database. Then
   refund it in Razorpay (**Payments › the payment › Refund**).

## 10. Google sign-in for everyone (5 minutes)

1. **console.cloud.google.com**, the sign-in project (not the Gmail one) ›
   **Google Auth Platform › Audience**.
2. If Publishing status says **Testing**, tap **Publish app** and confirm.
   In Testing only 100 listed test users can sign in. AskLocker asks only for
   your name and email, so publishing needs no review from Google.

Showing "AskLocker" instead of the Supabase address in Google's window
(brand verification) is later work, not needed to launch.

## 11. Fingerprint sign-in on PROD (2 minutes)

Supabase **PROD › Authentication › Passkeys**: Enable. Relying Party name
`AskLocker`, RP ID `asklocker.com`, origins `https://asklocker.com` and
`https://www.asklocker.com`. If it is already like this, nothing to do.

## 12. The last walk through PROD (about 20 minutes, the day before launch)

On asklocker.com, with your own account:

1. Sign in with Google.
2. Add a PDF and a photo to your personal vault.
3. Ask a question about each and check the answer and its source.
4. Create a family vault, invite a second Google account of yours, accept
   on the second account.
5. On the second account: see the family's documents, and add one.
6. Make a share link for a document and open it in a private window.
7. Plans: the prices show, and Pay opens Razorpay (once it is live).
8. Settings › Notifications › turn on for this browser, then **Send a test**.
9. Delete the second account (Settings › Security › Delete account).
10. Open asklocker.com/terms, /refunds and /contact.

Tell Claude anything that looked wrong.

## What Claude does, without waiting

- Puts the Expo Project ID into the app and starts each build; watches the
  build and fixes what fails.
- Puts the legal facts on the terms and contact pages.
- Checks each step that can be checked from the database: 075 and the
  security sweep, a payment reaching PROD, a phone's notification device.
- Releases `dev` to `main` when a step needs it.
- Keeps the launch checklist ticked, and the daily reminder at 8:36 says
  what is next.
