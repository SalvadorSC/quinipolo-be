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
   - `GLOBAL_LEAGUE_ID`: ID of the global league (optional)

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

## Project Structure

- `app.js` - Main application entry point
- `controllers/` - Request handlers
- `routes/` - API route definitions
- `services/` - Business logic and external service integrations
- `middleware/` - Express middleware
- `models/` - Data models
- `utils/` - Utility functions
