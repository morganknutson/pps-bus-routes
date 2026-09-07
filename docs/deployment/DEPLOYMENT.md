# Deployment Guide for PPS Bus Maps

This app is **not** deployed to Railway, Render, Vercel, GoDaddy, or any third-party
PaaS. It's self-hosted on a Mac Pro, run by **[makserve](https://github.com/morganknutson/makserve)**
— a small internal tool that runs a fleet of Dockerized sites on that machine, fronted
by nginx and a Cloudflare Tunnel.

If you're reading an older doc in this repo (or in git history) that mentions Railway,
Render, Vercel, or a VPS setup guide — it's stale and describes a deployment path that
was never actually used in production. This is the accurate one.

## The two sites

Both live as separate directories on the server (`/Users/morganknutson/Sites/`), each
with its own git checkout, Docker container, and env files:

| Site | Directory | Repo branch | Container | Port | Auto-deploy |
|---|---|---|---|---|---|
| **Production** | `portlandschoolbuses.com` | `main` | `portlandschoolbusescom-web-1` | 3001→3005 | ✅ GitHub webhook on push to `main` |
| **Dev** | `portlandschoolbuses.com-dev` | `main` | `ppsbus-dev-web` | 7780→3005, 7781→3000 | ❌ manual only (see below) |

Both are checkouts of `https://github.com/morganknutson/pps-bus-routes`. There is no
separate "dev branch" — dev and prod both track `main`; dev just doesn't redeploy
automatically when `main` moves.

- **Prod** builds with `Dockerfile` (multi-stage: `vite build` the frontend, then a
  slim Node image serving the built static files + Express backend).
- **Dev** builds with `Dockerfile.dev` (single stage, runs `npm run dev`, i.e. the Vite
  dev server + `node --watch` backend) and bind-mounts `frontend/src`, `backend/services`,
  etc. for live reload.

## How a deploy actually happens

`makserve` (CLI + a `com.makserve.api` daemon running on the server) wraps
`git pull && docker compose up -d --build` per site. Three ways that gets triggered:

1. **GitHub webhook (prod only).** The `pps-bus-routes` repo has a webhook pointed at
   `https://deploy.portlandschoolbuses.com/webhook/portlandschoolbuses.com`. Every push
   to `main` fires it, and the makserve API does the pull + rebuild automatically.
   Check registered webhooks with `gh api repos/morganknutson/pps-bus-routes/hooks`.
2. **Weekly sync workflow.** `.github/workflows/weekly-sync.yml` runs the backend's
   weekly PDF sync, commits any generated `data/...` changes to `main`, and — if the
   `MAKSERVE_DEPLOY_WEBHOOK_URL` repo secret is set — also POSTs to that webhook
   directly as a belt-and-suspenders trigger.
3. **Manual, from any machine on the tailnet:**
   ```bash
   makserve deploy portlandschoolbuses.com       # prod
   makserve deploy portlandschoolbuses.com-dev   # dev — this one you must run yourself
   ```

**The dev site has no GitHub webhook registered**, so pushing to `main` updates prod
automatically but leaves dev on whatever commit it was last manually deployed at. If
you need dev to reflect the latest `main`, run `makserve deploy portlandschoolbuses.com-dev`
yourself. (Registering a second webhook for dev is possible but not currently set up —
ask before adding one, since both sites share the same repo and branch.)

## Environment variables — read this before adding a new `VITE_*` var

This is the part that's easy to get wrong and will silently produce a broken build.

Each site directory has up to three separate env-ish locations:

- **`<site>/.env`** — read by `docker compose` for `${VAR}` substitution in
  `docker-compose.yml` (build args, `environment:` entries). This is where
  **frontend `VITE_*` vars must live.**
- **`<site>/backend/.env`** — bind-mounted read-only into the container at
  `/app/backend/.env`, read by the Node backend at runtime (`dotenv`). This is where
  **backend-only secrets** like `GOOGLE_MAPS_API_KEY` or `POSTHOG_API_KEY` live.
- **`<site>/docker-compose.yml`** — gitignored, per-server, **not** the same file as
  the tracked `docker-compose.dev.yml` template. Lists which env vars actually get
  passed into the container, either as build `args:` (prod, baked in at `vite build`
  time) or as `environment:` entries (dev, read live by the Vite dev server).

**`makserve env set <site> KEY=VALUE` writes to `backend/.env` if that file exists —
which it always does here.** That's correct for backend secrets, but wrong for a new
`VITE_*` var: docker compose never reads `backend/.env` for build-arg substitution, so
the var would be set but never actually reach the frontend build. Don't use
`makserve env set` for `VITE_*` vars — edit `<site>/.env` directly instead.

### Checklist for adding a new `VITE_*` env var

1. Add it to `<site>/.env` (root of the site directory) on the server, for **both**
   `portlandschoolbuses.com` and `portlandschoolbuses.com-dev`.
2. Add it to `docker-compose.yml`'s `build.args` (prod) or `environment:` (dev) —
   **in both the tracked template** (`docker-compose.dev.yml`) **and the live,
   gitignored `docker-compose.yml` in each site directory**, since the live file isn't
   regenerated from the template on deploy.
3. If it needs to reach a `vite build` (prod), also add `ARG VITE_FOO` /
   `ENV VITE_FOO=$VITE_FOO` to `Dockerfile`. Dev doesn't need this — `Dockerfile.dev`
   runs the Vite dev server, which reads `import.meta.env.VITE_*` straight from the
   container's process env.
4. Update `.env.example` at the repo root so local developers know the var exists.
5. Redeploy: `makserve deploy <site>` for each site you changed. A plain `restart`
   is **not** enough — it doesn't recreate the container, so it won't pick up new
   `.env`/`docker-compose.yml` values. You need `up -d` (which `deploy` runs via
   `--build`).

## Useful commands

```bash
makserve sites                          # list all sites on this server
makserve inspect portlandschoolbuses.com          # status, deployed commit, env var names
makserve inspect portlandschoolbuses.com-dev
makserve logs portlandschoolbuses.com 100 -f      # tail prod logs
makserve deploy portlandschoolbuses.com           # git pull + rebuild + restart (prod)
makserve deploy portlandschoolbuses.com-dev       # same, for dev
makserve shell portlandschoolbuses.com            # ssh + docker exec into the container
```

## Data persistence

`data/` and `runtime-data/` are bind-mounted from the host into the container (see
`docker-compose.yml`'s `volumes:`), so generated route/PDF data survives container
rebuilds. This isn't Railway/Render ephemeral storage — it's a real directory on the
Mac Pro's disk.

## Troubleshooting

- **Site shows old behavior after a push.** Check `makserve inspect <site>` — compare
  its reported commit against `git log origin/main`. If prod is behind, the webhook
  may have failed; check `gh api repos/morganknutson/pps-bus-routes/hooks` for the
  `last_response` status, or just run `makserve deploy portlandschoolbuses.com` by hand.
  If it's dev that's behind, that's expected — see "How a deploy actually happens" above.
- **New env var isn't showing up in the running app.** See the `VITE_*` checklist
  above — 90% of the time it's `backend/.env` vs `<site>/.env`, or the gitignored
  `docker-compose.yml` not having been updated to match the tracked template.
- **Build fails.** `makserve logs <site>` or `makserve deploy <site>` both surface the
  `docker compose build` output.
