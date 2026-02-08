/**
 * Vercel serverless function: pings the Render backend so it doesn't sleep.
 * Called by Vercel Cron (see vercel.json) or by an external cron (e.g. cron-job.org).
 * GET /api/keep-awake → fetches BACKEND_URL (default https://callpilot.onrender.com).
 */
const DEFAULT_BACKEND = "https://callpilot.onrender.com";

export default async function handler(
  req: { method?: string },
  res: { status: (n: number) => { end: (s?: string) => void; json: (o: object) => void } }
) {
  if (req.method !== "GET") {
    res.status(405).end("Method not allowed");
    return;
  }
  const url = process.env.BACKEND_URL || DEFAULT_BACKEND;
  try {
    const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(15000) });
    const ok = response.ok;
    res.status(200).json({
      ok,
      backend: url,
      status: response.status,
      message: ok ? "Backend pinged" : `Backend returned ${response.status}`,
    });
  } catch (err) {
    res.status(200).json({
      ok: false,
      backend: url,
      error: err instanceof Error ? err.message : String(err),
      message: "Ping failed (backend may be waking up)",
    });
  }
}
