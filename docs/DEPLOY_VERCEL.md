# Deploying with Vercel

Vercel hosts your **frontend** (React/Vite) only.

## UV hardlink warning in build logs

If you see:

```text
warning: Failed to hardlink files; falling back to full copy. ...
If this is intentional, set `export UV_LINK_MODE=copy` or use `--link-mode=copy` to suppress this warning.
```

**Fix:** Set this **environment variable** so the warning is suppressed and the installer uses copy mode (works on Vercel’s filesystem):

1. **Vercel Dashboard** → your project → **Settings** → **Environment Variables**
2. Add: **Name** `UV_LINK_MODE`, **Value** `copy`
3. Apply to **Build** (or all), save, then redeploy.

The repo’s `vercel.json` also sets `UV_LINK_MODE=copy`; if the warning still appears, set it in the Dashboard as above. It does **not** run long-running Python servers. So when ElevenLabs calls your webhook, that request must go to a **separate backend**.

## Why you get 502

- Your **frontend** is at `https://callpilotai.vercel.app` (works).
- The **webhook** URL in ElevenLabs is probably `https://callpilotai.vercel.app/support-agent/webhook`.
- That path has **no backend** on Vercel → **502 Bad Gateway**.

## Option 1: Backend on another host (recommended)

Deploy the **Python backend** to a service that runs a long-lived process:

| Service   | Free tier | Deploy the `backend/` folder + `requirements.txt` + `data/` |
|----------|-----------|----------------------------------------------------------------|
| **Railway** | Yes       | New Project → Deploy from repo → Root directory, set start: `python -m backend.main` |
| **Render**  | Yes       | New Web Service → Build: `pip install -r requirements.txt`, Start: `python -m backend.main` |
| **Fly.io**  | Yes       | `fly launch` then set start command; ensure `PORT` is used (app already reads it) |

Then:

1. Copy the backend URL (e.g. `https://callpilot.onrender.com`).
2. In **ElevenLabs** → every tool’s webhook URL:  
   **`https://your-backend-host/support-agent/webhook`**  
   (e.g. `https://callpilot.onrender.com/support-agent/webhook`).
3. In your **frontend** (e.g. `.env` or Vercel env), set `VITE_API_URL` to that same backend URL if the UI calls the backend for anything.

Result: **Frontend on Vercel, backend on Railway/Render/Fly → no 502.**

## Option 2: Webhook as a Vercel Serverless Function

You can run **only the webhook** as a serverless function on Vercel so the webhook URL stays on the same domain. This requires adding a Vercel serverless function that runs the same webhook logic (and any dependencies it needs). It’s more work and has cold starts; Option 1 is simpler and more reliable.

## Keep Render backend awake (free tier)

Render free tier spins down after ~15 minutes of inactivity. Two options:

1. **Vercel Cron** (already configured): `vercel.json` has a cron that calls **GET /api/keep-awake** every 14 minutes. The `api/keep-awake.ts` function pings your backend URL. On **Vercel Pro** this runs every 14 min; on **Hobby** the cron may run less often, so use (2) as backup.
2. **Local pinger**: Run `python scripts/ping_render.py` in a terminal (or on a server/cron). It pings `https://callpilot.onrender.com` every 10 minutes. Override with `BACKEND_URL` / `PING_INTERVAL_SECONDS` if needed.

Optional: set **BACKEND_URL** in Vercel → Environment Variables to your Render URL so the keep-awake function pings the correct host.

## Summary

- **Vercel** = frontend (and optional serverless functions).
- **Backend** = deploy to Railway, Render, or Fly.io and point the ElevenLabs webhook (and `VITE_API_URL` if needed) to that backend URL.
