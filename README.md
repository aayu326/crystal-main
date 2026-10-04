# Crystal® Diwali Festive Selfie Studio

A production-ready React + Vite campaign site: visitors register, add a selfie,
fit it into a festive Diwali portrait frame, and download/share the result.
Built for Crystal® / JIVORA®, but the template, branding text and colours are
kept in a few clearly separated files so they're easy to swap for another
campaign.

Live UX reference used during the build: `crystal-selfie.vercel.app`.

## Features

- Landing page in **Marathi / Hindi / English** (fully translated UI, not just labels)
- Registration form: name, +91 mobile (10-digit, no OTP), state, district, "used before" toggle, consent
- **All Indian states & union territories with their districts**, state → district cascading select
- Gallery upload **and** live camera capture (`getUserMedia`)
- Fully interactive photo editor: drag, pinch/wheel zoom, rotate, reset — mouse + touch
- Canvas-based festive portrait generator (garland, diyas, cotton motif, JIVORA banner, name + district/state badge)
- Unique reference number generation (`CCPL-XXXXXXXX`) with collision checks
- Result modal with **Download** and **Share** (Web Share API with a WhatsApp link fallback)
- Supabase-ready persistence (registrations + portraits + storage buckets), with an **automatic local-storage mock** so the app runs fully offline/without credentials
- Protected `/admin` dashboard: stats, state breakdown, search, filters, pagination, CSV export, portrait thumbnails
- Friendly, translated error handling everywhere (camera, network, validation, canvas)

## Quick start

```bash
npm install
npm run dev
```

The app runs immediately with **no configuration**: without Supabase
credentials it automatically uses `localStorage` for registrations/portraits
and object URLs for "uploaded" images, so every feature — including the admin
dashboard — works out of the box for local development and demos.

## Connecting Supabase (optional, for production)

1. Create a Supabase project.
2. Run `supabase_schema.sql` in the SQL editor — it creates the
   `registrations` and `portraits` tables, indexes, RLS policies, and the
   `campaign-photos` / `generated-portraits` storage buckets.
3. Copy `.env.example` to `.env` and fill in:

   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   VITE_ADMIN_PASSCODE=choose-something-only-your-team-knows
   ```

   Never put the Supabase **service role** key in this file or anywhere in
   the frontend — only the public anon key, which is safe to ship to
   browsers because access is controlled by the Row Level Security policies
   in `supabase_schema.sql`.

4. Restart `npm run dev`. The app detects the credentials and switches from
   the local mock to the real backend automatically — no code changes
   needed.

### Securing `/admin`

The shipped `/admin` route uses a simple client-side passcode
(`VITE_ADMIN_PASSCODE`) stored only in `sessionStorage`, intended for an
internal team behind a shared link during a short campaign. For anything
more sensitive:

- Put `/admin` behind Supabase Auth (email OTP or SSO) and scope a
  `service_role`-backed RLS policy to authenticated staff, or
- Deploy `/admin` on a separate, IP-restricted subdomain, or
- Front it with your existing SSO via a reverse proxy.

The admin table only ever reads through the anon key today, so if you tighten
RLS to authenticated-only, add real Supabase Auth sign-in before removing the
temporary read policy.

## Project structure

```text
src/
  components/       Reusable UI: form, uploader, editor, template, modal…
  pages/            Home.jsx (public flow), Admin.jsx (dashboard)
  data/             indiaLocations.js, translations.js
  services/         supabase.js, portraitGenerator.js, referenceNumber.js
  utils/            validation.js, imageUtils.js
  styles/           global.css
supabase_schema.sql
.env.example
```

## Customising the template

All portrait drawing lives in `src/services/portraitGenerator.js`. It draws
everything with Canvas 2D (no external image assets required), so you can:

- Change colours/typography by editing the small helper functions
  (`drawBackground`, `drawBrandHeader`, `drawFooterBanner`, …)
- Swap the JIVORA/Crystal copy by editing `src/data/translations.js`
  (`jivoraTagline`, `brandLine`, `hashtag`, etc.)
- Adjust the photo frame position/size via `getFrameGeometry()` — both the
  live editor and the final export read from this single function, so they
  always stay pixel-consistent.

## Deploying to Vercel

```bash
npm run build
```

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import the repo in Vercel → Framework preset **Vite**.
3. Add the same environment variables from `.env` under
   **Project Settings → Environment Variables**.
4. Deploy. Vercel will run `npm run build` and serve `dist/`.

## Notes on the reference implementation

- District lists cover every state/UT; a few very recently split districts
  may need a one-line addition to `src/data/indiaLocations.js` as India's
  administrative map continues to evolve — the array is intentionally flat
  and easy to edit.
- The portrait canvas renders at 1200×1500px for crisp downloads/WhatsApp
  sharing; change `TEMPLATE_WIDTH`/`TEMPLATE_HEIGHT` in
  `portraitGenerator.js` if you need a different aspect ratio.
- Uploaded photos are never modified server-side — cropping/zoom/rotation is
  applied entirely on canvas at generation time from the same transform the
  user sees while editing.
