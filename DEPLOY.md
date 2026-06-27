# Deploying the Dispatch console to Render

The frontend is served by the same Express app, so the deployed URL opens straight
into the interactive console — no separate static host needed.

## Option A — Blueprint (one click)

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, select the repo. `render.yaml` provisions the
   web service **and** a free PostgreSQL database, and wires `DATABASE_URL` for you.
3. Once the database shows **Available**, initialise the schema **once** (enables
   PostGIS + creates the tables). From your machine, using the database's
   **External Connection** string:

   ```bash
   psql "<EXTERNAL_DATABASE_URL>" -f scripts/init.sql
   ```

4. Open the web service URL. Click **Deploy fleet**, then play.

## Option B — Manual web service

1. **New → Web Service**, connect the repo.
2. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
3. Create a PostgreSQL instance (Render Postgres supports the `postgis` extension).
4. Add env var `DATABASE_URL` (the database's connection string) and
   `NODE_ENV=production`.
5. Run `scripts/init.sql` against the database once (see step 3 above).
6. Open the service URL.

## Notes

- Render sets `PORT` automatically; the app already reads `process.env.PORT`.
- SSL is enabled automatically when `NODE_ENV=production`.
- The console drives these endpoints (all same-origin, no config needed):
  `/api/simulate/context`, `/status`, `/seed`, `/reset`, `/stress`, `/run-all`,
  plus the existing `/api/rides/*` and `/api/cabs/*`.
- The seed/reset/stress endpoints write demo data on purpose — that's what makes
  the public demo interactive. Anyone visiting can deploy a fleet and run the suite.
