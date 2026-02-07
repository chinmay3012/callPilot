/**
 * Webhook Handler — POST /call-status
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  NON-FUNCTIONAL PLACEHOLDER — NO REAL HTTP SERVER
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This module defines the complete webhook handler for receiving
 * ElevenLabs tool-call callbacks. In production, this would be an
 * Express/Hono route handler on the Node.js backend.
 *
 * ─── Request Flow ──────────────────────────────────────────────────────
 *
 *   ElevenLabs Voice Agent
 *       │
 *       │  Voice agent invokes book_appointment tool
 *       │
 *       ▼
 *   POST /call-status (HTTPS required)
 *       │
 *       │  1. Validate webhook signature (optional, recommended)
 *       │  2. Parse & validate CallStatusWebhookPayload
 *       │  3. Log receipt with timestamp + agentId
 *       │  4. Forward to SwarmOrchestrator.processWebhookResult()
 *       │  5. Orchestrator emits: swarm:update, agent:booked, swarm:completed
 *       │
 *       ▼
 *   Response: 200 OK { received: true }
 *
 * ─── HTTPS Requirement ─────────────────────────────────────────────────
 *
 * ElevenLabs requires HTTPS for webhook URLs. Options:
 *
 *   Development:
 *     - ngrok:        ngrok http 3001 → https://abc123.ngrok.io/call-status
 *     - localtunnel:  lt --port 3001  → https://xyz.loca.lt/call-status
 *     - Cloudflare Tunnel: cloudflared tunnel --url http://localhost:3001
 *
 *   Production:
 *     - Deploy behind a reverse proxy with TLS (nginx, Caddy, etc.)
 *     - Or use a cloud platform with built-in HTTPS (Railway, Render, Fly.io)
 *
 *   The public URL must be configured in:
 *     1. Environment variable: PUBLIC_WEBHOOK_URL
 *     2. ElevenLabs agent dashboard: Agent → Tools → Webhook URL
 *        Set to: ${PUBLIC_WEBHOOK_URL}/call-status
 *
 * ─── Migration Guide ───────────────────────────────────────────────────
 *
 *   To wire this into a real Express server:
 *
 *     import { createWebhookHandler } from './webhookHandler';
 *     const handler = createWebhookHandler(orchestrator);
 *     app.post('/call-status', handler);
 *
 *   The handler function signature matches Express middleware:
 *     (req, res) => void
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

import type {
  CallStatusWebhookPayload,
  ElevenLabsToolCall,
} from "./types";
import { ENV_CONFIG } from "./env.config";
import type { SwarmOrchestrator } from "./SwarmOrchestrator";

// ─── Payload Validation ─────────────────────────────────────

/** Validation result for incoming webhook payloads */
export interface WebhookValidationResult {
  valid: boolean;
  error?: string;
  payload?: CallStatusWebhookPayload;
}

/**
 * Validate an incoming webhook payload against the CallStatusWebhookPayload shape.
 *
 * In production, this would be called at the top of the route handler
 * before any processing occurs.
 */
export function validateWebhookPayload(body: unknown): WebhookValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const payload = body as Record<string, unknown>;

  // Required fields
  if (typeof payload.conversation_id !== "string") {
    return { valid: false, error: "Missing or invalid: conversation_id (string)" };
  }
  if (typeof payload.agent_id !== "string") {
    return { valid: false, error: "Missing or invalid: agent_id (string)" };
  }
  if (typeof payload.provider_name !== "string") {
    return { valid: false, error: "Missing or invalid: provider_name (string)" };
  }
  if (typeof payload.booking_confirmed !== "boolean") {
    return { valid: false, error: "Missing or invalid: booking_confirmed (boolean)" };
  }
  if (!Array.isArray(payload.tool_calls)) {
    return { valid: false, error: "Missing or invalid: tool_calls (array)" };
  }

  const validStatuses = ["in_progress", "completed", "failed", "no_answer"];
  if (!validStatuses.includes(payload.call_status as string)) {
    return {
      valid: false,
      error: `Invalid call_status: "${payload.call_status}". Must be one of: ${validStatuses.join(", ")}`,
    };
  }

  // Validate tool_calls structure
  for (const tc of payload.tool_calls as unknown[]) {
    const toolCall = tc as Record<string, unknown>;
    if (typeof toolCall.tool_call_id !== "string") {
      return { valid: false, error: "tool_calls[].tool_call_id must be a string" };
    }
    if (toolCall.tool_name !== "book_appointment") {
      return { valid: false, error: `Unsupported tool_name: "${toolCall.tool_name}". Expected "book_appointment"` };
    }
    if (!toolCall.parameters || typeof toolCall.parameters !== "object") {
      return { valid: false, error: "tool_calls[].parameters must be an object" };
    }
    const params = toolCall.parameters as Record<string, unknown>;
    if (typeof params.provider_name !== "string") {
      return { valid: false, error: "tool_calls[].parameters.provider_name must be a string" };
    }
    if (typeof params.slot_time !== "string") {
      return { valid: false, error: "tool_calls[].parameters.slot_time must be a string" };
    }
    if (typeof params.reasoning !== "string") {
      return { valid: false, error: "tool_calls[].parameters.reasoning must be a string" };
    }
  }

  return {
    valid: true,
    payload: payload as unknown as CallStatusWebhookPayload,
  };
}

// ─── Webhook Signature Verification ─────────────────────────

/**
 * Verify the ElevenLabs webhook signature (placeholder).
 *
 * In production:
 *   1. Extract the signature from the x-elevenlabs-signature header
 *   2. Compute HMAC-SHA256 of the raw request body using ELEVENLABS_WEBHOOK_SECRET
 *   3. Compare signatures using constant-time comparison
 *
 * @param _rawBody - The raw request body as a string (before JSON parsing)
 * @param _signature - The x-elevenlabs-signature header value
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(_rawBody: string, _signature: string): boolean {
  // ┌─────────────────────────────────────────────────────────┐
  // │ 🔌 INTEGRATION POINT: SIGNATURE VERIFICATION           │
  // │                                                         │
  // │ In production, implement HMAC-SHA256 verification:      │
  // │                                                         │
  // │   const crypto = require('crypto');                     │
  // │   const expected = crypto                               │
  // │     .createHmac('sha256', ENV_CONFIG.ELEVENLABS_WEBHOOK_SECRET) │
  // │     .update(rawBody)                                    │
  // │     .digest('hex');                                     │
  // │   return crypto.timingSafeEqual(                        │
  // │     Buffer.from(signature),                             │
  // │     Buffer.from(expected)                               │
  // │   );                                                    │
  // └─────────────────────────────────────────────────────────┘

  // Placeholder: always returns true in simulation
  return true;
}

// ─── Webhook Logging ────────────────────────────────────────

/**
 * Log webhook receipt for observability.
 *
 * In production, this would write to a structured logging service
 * (e.g., Datadog, CloudWatch, or a database audit table).
 */
export function logWebhookReceipt(payload: CallStatusWebhookPayload): void {
  const timestamp = new Date().toISOString();
  const toolNames = payload.tool_calls.map((tc: ElevenLabsToolCall) => tc.tool_name).join(", ");

  console.log(
    `[${timestamp}] 📨 Webhook received:`,
    JSON.stringify({
      conversation_id: payload.conversation_id,
      agent_id: payload.agent_id,
      provider_name: payload.provider_name,
      call_status: payload.call_status,
      booking_confirmed: payload.booking_confirmed,
      offered_slot: payload.offered_slot,
      tool_calls_count: payload.tool_calls.length,
      tool_names: toolNames,
    }, null, 2)
  );
}

// ─── Route Handler ──────────────────────────────────────────

/**
 * Express/Hono-compatible request and response interfaces.
 * These mirror the real framework types so the handler can be
 * dropped into a real server with zero changes.
 */
export interface WebhookRequest {
  body: unknown;
  headers: Record<string, string | undefined>;
  /** Raw body string for signature verification */
  rawBody?: string;
}

export interface WebhookResponse {
  status: (code: number) => WebhookResponse;
  json: (data: unknown) => void;
}

/**
 * Create the webhook route handler for POST /call-status.
 *
 * Usage in production (Express):
 *
 *   import { createWebhookHandler } from './webhookHandler';
 *   import { SwarmOrchestrator } from './SwarmOrchestrator';
 *
 *   const orchestrator = new SwarmOrchestrator();
 *   app.post('/call-status', createWebhookHandler(orchestrator));
 *
 * Usage in production (Hono):
 *
 *   import { createWebhookHandler } from './webhookHandler';
 *   app.post('/call-status', async (c) => {
 *     const handler = createWebhookHandler(orchestrator);
 *     // Adapt Hono context to handler interface
 *   });
 *
 * The handler:
 *   1. Optionally verifies the webhook signature
 *   2. Validates the payload shape
 *   3. Logs the receipt
 *   4. Forwards to orchestrator.processWebhookResult()
 *   5. Returns 200 OK
 *
 * The orchestrator then emits the same events used in simulation:
 *   - swarm:update (agent status change)
 *   - agent:booked (booking confirmed)
 *   - swarm:completed (swarm resolved)
 */
export function createWebhookHandler(
  orchestrator: SwarmOrchestrator
): (req: WebhookRequest, res: WebhookResponse) => void {
  return (req: WebhookRequest, res: WebhookResponse): void => {
    // ── Step 1: Signature verification (optional, recommended) ──
    if (ENV_CONFIG.ELEVENLABS_WEBHOOK_SECRET) {
      const signature = req.headers["x-elevenlabs-signature"] ?? "";
      const rawBody = req.rawBody ?? JSON.stringify(req.body);

      if (!verifyWebhookSignature(rawBody, signature)) {
        console.error("[Webhook] ❌ Invalid signature — rejecting request");
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }
    }

    // ── Step 2: Payload validation ──────────────────────────────
    const validation = validateWebhookPayload(req.body);

    if (!validation.valid || !validation.payload) {
      console.error(`[Webhook] ❌ Validation failed: ${validation.error}`);
      res.status(400).json({ error: validation.error });
      return;
    }

    const payload = validation.payload;

    // ── Step 3: Log receipt ──────────────────────────────────────
    logWebhookReceipt(payload);

    // ── Step 4: Forward to orchestrator ─────────────────────────
    // The orchestrator processes this identically to a simulated
    // agent result. It will:
    //   - Update agent state
    //   - Emit swarm:update events
    //   - Evaluate booking logic
    //   - Emit swarm:completed when all agents have reported
    //
    // This achieves one-to-one parity with the simulation flow.
    orchestrator.processWebhookResult(payload);

    // ── Step 5: Acknowledge receipt ─────────────────────────────
    res.status(200).json({
      received: true,
      conversation_id: payload.conversation_id,
      agent_id: payload.agent_id,
      timestamp: new Date().toISOString(),
    });
  };
}
