# Deploying the Dispatch console to Render

The frontend is served by the same Express app, and the app runs on a built-in
**in-memory store** when no `DATABASE_URL` is set — so the live deployment needs
**no database, no Redis, and no URLs at all**. Anyone (e.g. an interviewer) can
open the URL and use every feature immediately. State is per-instance and resets
when the service restarts, which is exactly what you want for a demo.

## Deploy (one click)

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, select the repo, **Apply**. `render.yaml`
   creates a single web service (`npm install` / `npm start`). That's it.
3. Open the service URL → **Deploy fleet** → play.

No connection strings, no schema step, nothing expires after 30 days.

## How it works

- `src/config/database.js` checks for `DATABASE_URL`. If it's absent, the app uses
  `src/store/memoryStore.js` (an in-process store with a per-ride async lock that
  preserves the no-double-booking guarantee). If it's present, the app uses the
  real PostgreSQL + PostGIS path instead — unchanged.
- So the same code base runs two ways:
  - **Render (no DATABASE_URL)** → in-memory, zero infrastructure.
  - **Local / production with a real DB** → `docker-compose up -d` + `DATABASE_URL`
    in `.env`, then `scripts/init.sql` once. This is the full PostgreSQL/PostGIS
    backend with `SELECT ... FOR UPDATE` row-locking.

## Notes

- Render sets `PORT` automatically; the app already reads `process.env.PORT`.
- Render's **free** web service sleeps after ~15 min idle, so the first visit
  after a quiet period takes ~30–60s to wake. No data is lost that matters — the
  demo seeds fresh in seconds.
- The console drives these endpoints (all same-origin): `/api/simulate/context`,
  `/status`, `/seed`, `/reset`, `/stress`, `/run-all`, plus `/api/rides/*`.
