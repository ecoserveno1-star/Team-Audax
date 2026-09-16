# EcoServe

An AI platform that turns a hotel's food, water, and energy data into two clear
numbers — an EcoScore (efficiency) and a Savings Score (money saved) — priced
and reported in Sri Lankan Rupees (LKR).

This is a full-stack app:
- **Frontend**: a single `index.html` (marketing site + embedded React dashboard,
  compiled in-browser via Babel — no build step).
- **Backend**: Node.js + Express (`server/`), with real user accounts (JWT auth),
  a PostgreSQL database, and an AI chatbot.
- **Chatbot**: uses the real Claude API when `ANTHROPIC_API_KEY` is set;
  otherwise falls back automatically to a built-in sustainability assistant
  (`server/knowledge.js`) with no external calls and no cost.

## Deploy to Render (recommended)

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In the Render dashboard: **New → Blueprint**, and point it at this repo.
   Render reads `render.yaml` and provisions both the web service and a free
   Postgres database automatically — `DATABASE_URL` and `JWT_SECRET` are wired
   up for you, no manual config needed.
3. Once it's live, open the service's **Environment** tab and add
   `ANTHROPIC_API_KEY` if you want the chatbot to use the real Claude API
   instead of the built-in assistant. Leave it unset to use the built-in
   assistant — it works out of the box either way.
4. Render gives you a `https://<your-service>.onrender.com` URL — that's your
   live site.

## Local development

Requires Node.js 18+ and a Postgres database.

```bash
npm install
cp .env.example .env
# edit .env: set DATABASE_URL to your local Postgres, and JWT_SECRET to any long random string
npm run dev
```

Then open `http://localhost:3000`.

## How the data works

- Sign up (via "Log in" in the header, then "Create a free account") to get a
  real account with 30 days of realistic starter data pre-loaded.
- "Add Hotel Data" persists real entries to Postgres.
- EcoScore, Savings Score, and estimated LKR savings are computed from that
  data against expected usage for your occupancy and room count
  (`server/economics.js` — includes the reference Sri Lankan commercial
  utility rates used for the cost estimates).
- "Launch live demo" (separate from login) shows a sample/mock dashboard for
  exploring the UI without an account — it doesn't touch the database.
