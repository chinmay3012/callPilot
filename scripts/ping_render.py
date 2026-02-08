#!/usr/bin/env python3
"""
Ping the Render backend periodically so it doesn't sleep (free tier spins down after ~15 min).
Run locally: python scripts/ping_render.py
Override URL: BACKEND_URL=https://your-backend.onrender.com python scripts/ping_render.py
"""
import os
import sys
import time
import urllib.request
import urllib.error

DEFAULT_URL = "https://callpilot.onrender.com"
INTERVAL_MINUTES = 10  # Render free tier sleeps after ~15 min; ping before that


def ping(url: str) -> bool:
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=30) as r:
            code = r.status
            if code == 200:
                return True
            print(f"[ping] {url} returned {code}", flush=True)
            return False
    except urllib.error.HTTPError as e:
        print(f"[ping] HTTP error: {e.code} {e.reason}", flush=True)
        return False
    except urllib.error.URLError as e:
        print(f"[ping] URL error: {e.reason}", flush=True)
        return False
    except Exception as e:
        print(f"[ping] Error: {e}", flush=True)
        return False


def main():
    url = (os.environ.get("BACKEND_URL") or DEFAULT_URL).rstrip("/")
    interval_secs = int(os.environ.get("PING_INTERVAL_SECONDS", INTERVAL_MINUTES * 60))
    print(f"Pinging {url} every {interval_secs}s (Ctrl+C to stop)", flush=True)
    while True:
        ok = ping(url)
        ts = time.strftime("%H:%M:%S")
        print(f"[{ts}] {'OK' if ok else 'FAIL'}", flush=True)
        time.sleep(interval_secs)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)
        sys.exit(0)
