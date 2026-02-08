/**
 * ElevenLabs Voice Agent Configuration
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  NON-FUNCTIONAL PLACEHOLDER — NO REAL API CALLS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This module defines the voice agent persona, tool definitions, and
 * provider readiness flags. Everything here is a contract specification
 * that documents exactly how the ElevenLabs integration will work.
 *
 * When real integration begins:
 *   1. The VOICE_AGENT_PERSONA becomes the system prompt in the
 *      ElevenLabs agent dashboard
 *   2. The TOOL_DEFINITIONS become custom tools registered on the agent
 *   3. The WEBHOOK_CONFIG tells ElevenLabs where to POST tool call results
 *   4. Provider configs drive which agents get real outbound calls
 *
 * No code in this file makes network requests or imports the SDK.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Voice Agent Persona ────────────────────────────────────
//
// This prompt will be set in the ElevenLabs agent dashboard:
//   Agent → Prompt → System Prompt
//
// It defines how the voice agent behaves during provider calls.

export const VOICE_AGENT_PERSONA = {
  role: "Professional medical scheduling assistant",
  tone: "Calm, polite, and efficient",
  objective: [
    "Greet the receptionist and identify yourself as calling on behalf of the patient",
    "Ask for available appointment slots for the requested service",
    "Reject any slot offered before 9:30 AM — politely ask for a later option",
    "Once an acceptable slot is found (9:30 AM or later), confirm the booking",
    "Invoke the book_appointment tool with the confirmed slot details",
    "Thank the receptionist and end the call",
  ],
  constraints: [
    "Never accept a slot before the minimum valid time (9:30 AM)",
    "Do not negotiate price or insurance — only scheduling",
    "If no valid slot is available, politely end the call without booking",
    "Keep the call under 60 seconds when possible",
  ],

  /**
   * The full system prompt text that would be pasted into the
   * ElevenLabs agent configuration dashboard.
   */
  systemPrompt: `You are a professional medical scheduling assistant calling on behalf of a patient. Your tone is calm, polite, and efficient.

Your objective:
1. Greet the receptionist and state you are calling to schedule an appointment.
2. Use the query_calendar tool to check the patient's free slots so you only request times that avoid double booking.
3. Ask what appointment slots are available. Use lookup_provider if you need details about this provider (rating, distance).
4. When the receptionist offers a slot, use validate_slot to confirm it does not conflict with the patient's calendar and meets preferences.
5. If a slot is offered before 9:30 AM, politely decline and ask for a later option. Adapt your negotiation: if they have limited slots, ask for the next best time.
6. If information is missing (e.g., exact time, date, or provider name), ask clarifying questions before confirming.
7. Once an acceptable slot is validated, call the book_appointment tool with the provider name, slot time, and your reasoning.
8. Thank the receptionist and end the call.

Constraints:
- Never accept a slot before 9:30 AM. Use validate_slot before committing.
- Do not discuss pricing, insurance, or anything beyond scheduling.
- If no valid slot is available or calendar conflicts, politely end the call without booking.
- Keep the call concise — under 60 seconds when possible.
- When information is missing, ask one clear clarifying question at a time; then adapt your negotiation strategy based on the answer.`,
} as const;

// ─── Tool Definitions ───────────────────────────────────────
//
// These are registered in the ElevenLabs agent dashboard:
//   Agent → Tools → Add Custom Tool
//
// The voice agent invokes these tools during the call. ElevenLabs
// then POSTs the tool call to the configured webhook URL.

// Agentic functions — tool calling as the brain (calendar, provider lookup, distance, slot validation)
export const TOOL_DEFINITIONS = {
  query_calendar: {
    name: "query_calendar",
    description:
      "Check the patient's calendar for available time windows. Use before requesting slots from the receptionist to avoid double booking. Returns free slots for today.",
    parameters: {
      type: "object" as const,
      properties: {
        for_date: {
          type: "string" as const,
          description: "Date to check: 'today', 'tomorrow', or YYYY-MM-DD",
        },
      },
      required: [],
    },
  },
  lookup_provider: {
    name: "lookup_provider",
    description:
      "Get provider details: name, Google rating, distance from patient. Use when you need to compare or confirm provider info.",
    parameters: {
      type: "object" as const,
      properties: {
        provider_name: { type: "string" as const, description: "Name of the provider (e.g., 'Dr. Sarah Chen')" },
        provider_id: { type: "string" as const, description: "Optional provider ID if known" },
      },
      required: ["provider_name"],
    },
  },
  calculate_distance: {
    name: "calculate_distance",
    description:
      "Get travel distance and estimated travel time from patient to provider. Use to inform scheduling preference (closer = better).",
    parameters: {
      type: "object" as const,
      properties: {
        provider_name: { type: "string" as const, description: "Name of the provider" },
        provider_address: { type: "string" as const, description: "Provider address if known" },
      },
      required: ["provider_name"],
    },
  },
  validate_slot: {
    name: "validate_slot",
    description:
      "Validate a proposed appointment slot: checks patient calendar for conflicts (double booking) and that the time is not before 9:30 AM. Call before confirming with the receptionist.",
    parameters: {
      type: "object" as const,
      properties: {
        slot_time: { type: "string" as const, description: "Proposed time (e.g., '10:30 AM')" },
        provider_name: { type: "string" as const, description: "Provider name for logging" },
      },
      required: ["slot_time", "provider_name"],
    },
  },
  book_appointment: {
    name: "book_appointment",
    description:
      "Confirm and book an appointment slot. Call only after validate_slot has confirmed the slot is free and valid. Call once the receptionist confirms an available slot (9:30 AM or later).",
    parameters: {
      type: "object" as const,
      properties: {
        provider_name: {
          type: "string" as const,
          description: "Name of the dental provider (e.g., 'Dentist A')",
        },
        slot_time: {
          type: "string" as const,
          description: "The confirmed appointment time (e.g., '10:30 AM')",
        },
        reasoning: {
          type: "string" as const,
          description:
            "Brief explanation for choosing this slot (e.g., 'Earliest available slot after 9:30 AM')",
        },
      },
      required: ["provider_name", "slot_time", "reasoning"],
    },
  },
} as const;

// ─── Webhook Configuration ──────────────────────────────────
//
// ElevenLabs sends tool call results and call status updates here.
// Configured in the ElevenLabs agent dashboard:
//   Agent → Tools → Webhook URL

export const WEBHOOK_CONFIG = {
  /**
   * The endpoint ElevenLabs will POST tool calls to.
   * In production: https://your-domain.com/call-status
   * In development: tunneled via ngrok or similar
   */
  endpoint: "/call-status",

  /**
   * Expected HTTP method for incoming webhooks.
   */
  method: "POST" as const,

  /**
   * Headers the webhook handler should validate.
   * ElevenLabs includes these for authentication.
   */
  expectedHeaders: {
    "content-type": "application/json",
    // In production, validate the ElevenLabs webhook signature:
    // "x-elevenlabs-signature": "<signature>"
  },
} as const;

// ─── Provider Readiness Map ─────────────────────────────────
//
// Tracks which providers have live ElevenLabs voice agents configured.
// When elevenlabsReady is true, the orchestrator will initiate a real
// outbound call instead of running the simulation for that agent.
//
// Currently only Dentist A is enabled — others will be rolled out
// incrementally as voice agents are tested and validated.

export const ELEVENLABS_PROVIDER_CONFIG = {
  "agent-1": {
    elevenlabsReady: true,
    elevenlabsAgentId: "placeholder-agent-id-dentist-a",
    phoneNumber: "+1-555-0001",
    providerName: "Dentist A",
  },
  "agent-2": {
    elevenlabsReady: false,
    elevenlabsAgentId: null,
    phoneNumber: "+1-555-0002",
    providerName: "Dentist B",
  },
  "agent-3": {
    elevenlabsReady: false,
    elevenlabsAgentId: null,
    phoneNumber: "+1-555-0003",
    providerName: "Dentist C",
  },
  "agent-4": {
    elevenlabsReady: false,
    elevenlabsAgentId: null,
    phoneNumber: "+1-555-0004",
    providerName: "Dentist D",
  },
  "agent-5": {
    elevenlabsReady: false,
    elevenlabsAgentId: null,
    phoneNumber: "+1-555-0005",
    providerName: "Dentist E",
  },
} as const;

// ─── Voice Configuration ────────────────────────────────────
//
// ElevenLabs voice settings for the scheduling agent.
// Configured in the agent dashboard: Agent → Voice

export const VOICE_CONFIG = {
  /** ElevenLabs voice ID — "George" is professional and clear */
  voiceId: "JBFqnCBsd6RMkjVDRZzb",
  voiceName: "George",
  /** Model optimized for low-latency conversational use */
  model: "eleven_turbo_v2_5",
  settings: {
    stability: 0.7,
    similarity_boost: 0.75,
    style: 0.3,
    use_speaker_boost: true,
    speed: 1.0,
  },
} as const;
