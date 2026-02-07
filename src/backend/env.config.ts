/**
 * Environment Configuration — Placeholders for production secrets.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  NON-FUNCTIONAL — No secrets are stored or used at runtime.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This module documents every environment variable the backend requires
 * in production. Values here are placeholders — real values would be
 * loaded from process.env on the server.
 *
 * ─── HTTPS Requirement ─────────────────────────────────────────────────
 *
 * ElevenLabs webhook callbacks require HTTPS. The PUBLIC_WEBHOOK_URL
 * must be a publicly accessible HTTPS endpoint.
 *
 *   Why HTTPS is required:
 *     1. ElevenLabs will only POST tool-call results to HTTPS URLs
 *     2. Webhook payloads contain booking data that must be encrypted in transit
 *     3. Signature verification (HMAC) requires transport security to be meaningful
 *
 *   Development options:
 *     ngrok:           npx ngrok http 3001
 *                      → https://abc123.ngrok-free.app
 *     localtunnel:     npx localtunnel --port 3001
 *                      → https://xyz.loca.lt
 *     Cloudflare:      cloudflared tunnel --url http://localhost:3001
 *                      → https://your-tunnel.trycloudflare.com
 *
 *   Production options:
 *     - Cloud platform with built-in TLS (Railway, Render, Fly.io)
 *     - Reverse proxy with TLS termination (nginx + Let's Encrypt, Caddy)
 *     - Supabase Edge Functions (HTTPS by default)
 *
 * ─── Where to configure the public URL ─────────────────────────────────
 *
 *   1. Set PUBLIC_WEBHOOK_URL in your .env or hosting platform
 *   2. Set the same URL in the ElevenLabs agent dashboard:
 *      Agent → Tools → book_appointment → Webhook URL
 *      Value: ${PUBLIC_WEBHOOK_URL}/call-status
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

export const ENV_CONFIG = {
  // ─── Webhook URL ────────────────────────────────────────────
  //
  // The publicly accessible HTTPS URL where this server is reachable.
  // ElevenLabs will POST to: ${PUBLIC_WEBHOOK_URL}/call-status
  //
  // Examples:
  //   Development: "https://abc123.ngrok-free.app"
  //   Production:  "https://api.callpilot.com"
  //
  // In production: process.env.PUBLIC_WEBHOOK_URL
  PUBLIC_WEBHOOK_URL: "https://your-domain.com" as string,

  // ─── ElevenLabs Webhook Secret (optional) ───────────────────
  //
  // Used to verify that incoming webhooks are genuinely from ElevenLabs.
  // When set, the webhook handler computes HMAC-SHA256 of the request
  // body and compares it to the x-elevenlabs-signature header.
  //
  // To obtain:
  //   1. Go to ElevenLabs dashboard → Agent → Security
  //   2. Generate or copy the webhook signing secret
  //   3. Set as ELEVENLABS_WEBHOOK_SECRET in your environment
  //
  // When null/empty, signature verification is skipped (not recommended
  // for production).
  //
  // In production: process.env.ELEVENLABS_WEBHOOK_SECRET
  ELEVENLABS_WEBHOOK_SECRET: null as string | null,

  // ─── ElevenLabs API Key ─────────────────────────────────────
  //
  // Required for initiating outbound calls via the ElevenLabs API.
  // NOT used for webhook handling (webhooks are inbound).
  //
  // To obtain:
  //   1. Go to https://elevenlabs.io → Profile → API Keys
  //   2. Generate a new key with Conversational AI permissions
  //   3. Set as ELEVENLABS_API_KEY in your environment
  //
  // In production: process.env.ELEVENLABS_API_KEY
  ELEVENLABS_API_KEY: null as string | null,

  // ─── Server Configuration ──────────────────────────────────
  //
  // Port and host for the backend HTTP server.
  //
  // In production: process.env.PORT / process.env.HOST
  PORT: 3001 as number,
  HOST: "0.0.0.0" as string,

  /**
   * Compute the full webhook callback URL.
   *
   * This is the URL configured in the ElevenLabs agent dashboard:
   *   Agent → Tools → book_appointment → Webhook URL
   */
  get webhookCallbackUrl(): string {
    return `${this.PUBLIC_WEBHOOK_URL}/call-status`;
  },
} as const;
