# Quinipolo Backend

Node.js/Express backend for the Quinipolo application.

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account and project
- Stripe account (for payment processing)

## Environment Setup

1. Copy the `.env.example` file to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Fill in the required environment variables in `.env`:

   ### Supabase Configuration
   - `SUPABASE_URL`: Your Supabase project URL (found in Supabase dashboard → Settings → API)
   - `SUPABASE_SERVICE_KEY`: Your Supabase service role key (found in Supabase dashboard → Settings → API)

   ### Stripe Configuration
   - `REACT_APP_ENV`: Set to `development` or `production`
   - `STRIPE_SECRET_KEY_TEST`: Your Stripe test mode secret key
   - `STRIPE_SECRET_KEY`: Your Stripe live mode secret key
   - `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook signing secret
   - `STRIPE_MANAGED_LEAGUE_PRICE_ID`: Stripe price ID for managed leagues
   - `STRIPE_SELF_MANAGED_LEAGUE_PRICE_ID`: Stripe price ID for self-managed leagues

   ### Frontend URL
   - `FRONTEND_URL`: URL of your frontend application (e.g., `http://localhost:3001`)

   ### Global League Configuration
   - `GLOBAL_LEAGUE_ID`: Id of the **live** Global league. Signup with the alias `"global"` joins this league (`user_leagues` + `leaderboard`). It is a free system league and does not go through Stripe Checkout.
   - `LEGACY_GLOBAL_LEAGUE_ID` (optional): 2025-2026 Global id, used only so that season's matchday labels keep their historical offset. Defaults to `351a1949-f6c5-4940-ac70-1c7dd08e8b1a`. Do not point this at the 2026-2027 Global.

   ### Scraper Configuration
   - `SCRAPER_USE_RFEN`: Set to `true` to use RFEN results, `false` otherwise

## Installation

```bash
npm install
```

## Running the Server

```bash
npm start
```

The server will start on `http://localhost:3000`.

## Finished leagues and the 2026–27 cutover

A league with `status = "finished"` stays readable (league detail, quinipolos, leaderboard, past results) but the API rejects a new quinipolo:

- `POST /api/quinipolos` returns **409** with `code: "LEAGUE_FINISHED"` and `league_status: "finished"`.
- `POST /api/quinipolos/all-leagues` and `POST /api/quinipolos/managed-leagues` only target `status = "active"`.

`GET` league, quinipolo, and leaderboard routes are unchanged and still return finished leagues. League payloads already include `status`.

**CNBeras is not finished.** It stays active and can still create quinipolos. Every other existing league, including the previous Global, is marked finished. A new free Global named `Global 2026-2027` is created and every profile is enrolled.

1. Apply `migrations/20260925_league_status_finished.sql` in the Supabase SQL editor (adds `finished` to the status check).
2. Deploy this backend.
3. Dry-run the cutover (no writes). It refuses to continue if it cannot find CNBeras or the previous Global:

   ```bash
   node scripts/season-cutover-2026-27.js
   ```

   If CNBeras is stored under another name, re-run with `--cnberas-id=<uuid>` taken from the dry-run list. Same for `--previous-global-id=<uuid>`.
4. Apply once the dry-run shows CNBeras under "excluded" and not under "to mark finished":

   ```bash
   node scripts/season-cutover-2026-27.js --apply
   ```

   The SQL equivalent, including a transactional dry-run, is `scripts/season-cutover-2026-27.sql`. Prefer that file if you want one database transaction. Do not create a Stripe Checkout session or a `league_subscriptions` row for the new Global.
5. Set `GLOBAL_LEAGUE_ID` to the printed id and restart the API. Do not commit `.env`. New signups that send `leagues: ["global"]` (and Google signup) join that id.

Re-running the cutover is safe: the season label is not appended twice, the new Global is not duplicated, memberships are skipped when they already exist, and CNBeras is never set to `finished`. If a previous run closed CNBeras, the script sets it back to `active`.

## Project Structure

- `app.js` - Main application entry point
- `controllers/` - Request handlers
- `routes/` - API route definitions
- `services/` - Business logic and external service integrations
- `middleware/` - Express middleware
- `models/` - Data models
- `utils/` - Utility functions
