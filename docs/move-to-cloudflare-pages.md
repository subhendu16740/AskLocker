# Moving the website from Vercel to Cloudflare Pages

The website is only a folder of files (`npm run build` makes it in `dist/`).
Cloudflare Pages builds and serves it for free, business use included.
Supabase, Groq, Razorpay and the Edge Functions do not change.

Two parts, in this order. **Part A** moves PROD (asklocker.com) and is
the one that matters before launch. **Part B** moves DEV; it can wait.
Vercel keeps serving until each part's switch, so nothing goes down, and
it stays as the way back for a week after.

Free plan: 500 builds a month for the whole Cloudflare account, DEV and
PROD together. AskLocker makes about 70 (60 merges into `dev`, 10
releases to `main` in the last 30 days).

**Moving both at once** (decided 21 October 2026): do DEV first, as a
rehearsal nobody else sees, then PROD:

1. A1, with both sets of variables: Production (A1 step 4) and Preview
   (B2).
2. Branch control as in B1 (`main`, and `dev` as the one preview branch),
   instead of A2.
3. B3 to B6 (DEV's Google origin, Supabase, passkeys, Gmail), then test
   DEV as in B7.
4. A3 to A6: PROD's DNS, the switch, the test.
5. A week later: delete the Vercel project (end of B7). Skip A7.

If asklocker.com was bought through Vercel, keep the Vercel account for
the domain itself (deleting the project does not touch it), or transfer
the domain to another registrar once it is 60 days old (from 5 December
2026).

---

## Part A: PROD on Cloudflare (asklocker.com)

### A1. Make the project

1. Sign up at dash.cloudflare.com (free, no card).
2. **Workers & Pages › Create › Pages › Connect to Git**. Allow
   Cloudflare's GitHub app on `subhendu16740/FamilyVault`, then pick it.
3. Fill in:

   | Setting | Value |
   |---|---|
   | Project name | `asklocker` (the site gets `asklocker.pages.dev`; if the name is taken, Cloudflare adds letters: use the name it shows wherever this list says `asklocker`) |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | leave empty |

   Cloudflare runs `npm ci` by itself before the build command, and
   `.node-version` in the repo picks Node 22.

4. Before **Save and Deploy**, open **Environment variables** and add
   the PROD values. Copy them from Vercel › the project › Settings ›
   Environment Variables, the ones marked **Production**:

   | Name | Value |
   |---|---|
   | `EXPO_PUBLIC_SUPABASE_URL` | `https://yrcmdixqgvmhqxejvlor.supabase.co` |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | PROD's anon key (as on Vercel) |
   | `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | as on Vercel |
   | `EXPO_PUBLIC_GOOGLE_WEB_ORIGINS` | `https://asklocker.com, https://www.asklocker.com` |

   Add `EXPO_PUBLIC_POSTHOG_KEY` / `EXPO_PUBLIC_POSTHOG_HOST` only if
   Vercel has them. The values are built into the app, so a variable
   added later needs **Deployments › Retry deployment**.

5. **Save and Deploy.** The first build takes a few minutes.

### A2. Build only `main` for now

**Settings › Builds & deployments › Branch control**: Production branch `main`,
automatic deployments on; **Preview branches: None**. (Part B turns on
`dev`.) Feature branches never build, which keeps the count low.

### A3. Check the new copy

Open `https://asklocker.pages.dev`. The login page should load with no
DEV badge, and `https://asklocker.pages.dev/settings/delete-account`
should open after a refresh. Don't sign in here: Google and Supabase know
only asklocker.com, which is the point of the next steps.

### A4. Move asklocker.com's DNS to Cloudflare

Cloudflare serves a main domain (asklocker.com, not a sub-address) only
when Cloudflare also runs its DNS. The site stays on Vercel during this
step.

1. Cloudflare › **Add a domain** › `asklocker.com` › **Free** plan.
2. Cloudflare copies the domain's records. Compare them with the list at
   the current DNS provider and add anything missing, especially:
   - **MX** and **TXT** records (email, Google Search Console, Razorpay or
     any other "verify your domain" record);
   - any **CAA** record. If there is one, delete it or make sure it allows
     Cloudflare's certificate authorities, or Cloudflare cannot issue the
     https certificate.
3. The records that point at Vercel (`A 76.76.21.21`,
   `CNAME cname.vercel-dns.com`, or similar): set them to **DNS only**
   (grey cloud) so Vercel keeps serving unchanged.
4. Where asklocker.com was bought (if through Vercel: Vercel › Domains),
   replace the nameservers with the two Cloudflare shows.
5. Wait for Cloudflare's "asklocker.com is active" email: minutes, at
   most a day. Nothing changes for visitors meanwhile.

### A5. Switch asklocker.com to Cloudflare Pages

1. Pages project › **Custom domains › Set up a domain** › `asklocker.com`.
   Cloudflare offers to replace the record pointing at Vercel: accept.
2. The same for `www.asklocker.com`.
3. Within a few minutes asklocker.com is served by Cloudflare, with
   https.

### A6. Test on asklocker.com

- Sign in with Google (the same button: the address hasn't changed).
- Fingerprint sign-in, on a device where it was on: still works, since
  passkeys belong to asklocker.com.
- Open a document, ask a question, upload a file.
- Settings › About shows a commit number.
- Refresh on a deep page (`/settings/storage`): it opens.
- Notifications already on keep working (same address).

**Nothing else changes for PROD**: Google sign-in's origins, Supabase's
Site URL and redirects, PROD passkeys, Razorpay (its webhook is
Supabase's), Gmail import and PostHog all use asklocker.com or Supabase.

**If something is wrong**: in Cloudflare › DNS, point the records back at
Vercel (the values noted in A4) and remove the custom domain from the
Pages project. Vercel still has the domain until A7.

### A7. A week later: stop Vercel serving PROD

Vercel › the project › Settings:
- **Domains**: remove `asklocker.com` and `www.asklocker.com`.
- **Environment Variables**: delete the **Production** ones, so `main`
  no longer builds a second PROD copy at a `.vercel.app` address.

If you are also doing Part B, skip this and delete the whole Vercel
project at B7 instead.

---

## Part B: DEV on Cloudflare (can wait)

Until this is done, DEV stays on Vercel at
`family-vault-git-dev-subhendu16740.vercel.app`. Vercel's free plan is
for non-commercial use, and a test copy of a product made to earn is
still part of it, so move DEV too before long.

### B1. Build `dev`

Pages project › **Settings › Builds & deployments › Branch control** › Preview
branches: **Custom branches**, include `dev`.

### B2. DEV's variables

**Settings › Environment variables**, environment **Preview** (copy the
Vercel ones marked Preview):

| Name | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://tkqsfoppwlyupentuixy.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | DEV's anon key |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | as on Vercel |
| `EXPO_PUBLIC_GOOGLE_WEB_ORIGINS` | `https://dev.asklocker.pages.dev` |

Then push or merge anything into `dev` (or **Retry deployment** on the
latest `dev` build). DEV's fixed address is
`https://dev.asklocker.pages.dev`.

### B3. Google sign-in

Google Cloud (the sign-in project) › APIs & Services › Credentials › the
OAuth client › **Authorized JavaScript origins** › add
`https://dev.asklocker.pages.dev`. Leave the others.

### B4. Supabase DEV › Authentication › URL Configuration

- **Site URL**: `https://dev.asklocker.pages.dev`
- **Redirect URLs**: add `https://*.asklocker.pages.dev/**`. Leave the
  Vercel ones until B7.

### B5. Supabase DEV › Authentication › Passkeys

- **RP ID**: `dev.asklocker.pages.dev`
- **Origins**: `https://dev.asklocker.pages.dev`

Fingerprint sign-in made on the old DEV address stops working; turn it on
again on the new one. PROD's passkeys are untouched.

### B6. Gmail import on DEV

Supabase DEV › Edge Functions › Secrets › `GMAIL_RETURN_ORIGINS`: add
`https://dev.asklocker.pages.dev` to what is there (comma between).

### B7. Test, then close Vercel

On `https://dev.asklocker.pages.dev`: the DEV badge, the test sign-in
form, Google, Ask, Upload, notifications (turn them on again: they are
per address), Gmail import's Connect.

After a week with both parts working: Vercel › the project › Settings ›
Advanced › **Delete Project**. Then tell Claude, which removes
`vercel.json` and updates CLAUDE.md.
