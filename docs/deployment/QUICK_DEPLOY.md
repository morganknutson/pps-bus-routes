# Quick Deploy Reference

Full details: [DEPLOYMENT.md](./DEPLOYMENT.md). This is just the command cheat sheet.

This app runs self-hosted via **makserve** — not Railway/Render/Vercel.

```bash
# Push to main -> prod auto-deploys via GitHub webhook. Nothing else to do.
git push origin main

# Dev does NOT auto-deploy. Run this yourself after pushing:
makserve deploy portlandschoolbuses.com-dev

# Force a prod redeploy without a new push (e.g. after changing server-side env vars):
makserve deploy portlandschoolbuses.com

# Check what commit each site is actually running:
makserve inspect portlandschoolbuses.com
makserve inspect portlandschoolbuses.com-dev
```

Adding a new `VITE_*` env var? Don't use `makserve env set` for it — see the
[env var checklist in DEPLOYMENT.md](./DEPLOYMENT.md#environment-variables--read-this-before-adding-a-new-vite_-var).
It writes to `backend/.env`, which the frontend build never reads.
