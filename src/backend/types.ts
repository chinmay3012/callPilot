/**
 * Shared types between backend simulation and frontend.
 *
 * In production, these would live in a shared package or
 * be generated from the backend's OpenAPI / GraphQL schema.
 */

/** Canonical service types — used for provider dataset selection and UI labels */
export type ServiceType =
  | "dentist"
  | "doctor"
  | "vet"
  | "plumber"
  | "salon"
  | "auto_repair"
  | "therapist";

export type AgentStatus =
  | "idle"
  | "searching"
  | "calling"
  | "negotiating"
  | "booked"
  | "rejected"
  | "cancelled";

export interface ProviderAgent {
  id: string;
  name: string;
  status: AgentStatus;
  slotTime: string | null;
  /** Whether this provider has a live ElevenLabs voice agent configured */
  elevenlabsReady: boolean;
}

// ─── Event Payloads (Socket.io / EventBus) ─────────────────

export interface SwarmStartPayload {
  swarmId: string;
  agents: ProviderAgent[];
  timestamp: number;
  /** Selected service type; frontend defaults to "dentist" if missing (backward compat) */
  service_type?: ServiceType;
}

export interface SwarmUpdatePayload {
  swarmId: string;
  agentId: string;
  status: AgentStatus;
  slotTime: string | null;
  message: string;
  /** Same as swarm:start; optional for backward compat */
  service_type?: ServiceType;
}

/** One entry in the ranked shortlist (earliest availability, rating, distance, user weights) */
export interface RankedShortlistEntry {
  rank: number;
  agentId: string;
  providerName: string;
  slotTime: string | null;
  score: number;
  rating?: number;
  distanceMiles?: number;
}

export interface SwarmCompletedPayload {
  swarmId: string;
  winnerId: string | null;
  winnerName: string | null;
  winnerSlot: string | null;
  allAgents: ProviderAgent[];
  /** Ranked shortlist for confirmation (from backend scoring) */
  rankedShortlist?: RankedShortlistEntry[];
  /** Same as swarm:start; optional for backward compat */
  service_type?: ServiceType;
}

/** User preference weights for scoring (sum to 1.0) */
export interface PreferenceWeights {
  earliest_availability?: number;
  rating?: number;
  distance?: number;
}

export interface AgentBookedPayload {
  swarmId: string;
  agentId: string;
  providerName: string;
  slotTime: string;
}

// ═══════════════════════════════════════════════════════════════
//  ELEVENLABS INTEGRATION CONTRACTS
// ═══════════════════════════════════════════════════════════════
//
// The types below define the exact data shapes that will flow
// between the ElevenLabs voice agents and the CallPilot backend.
// They are NOT used in the simulation — they exist purely to
// lock down the contract before real integration begins.
//
// Flow:
//   1. Orchestrator initiates outbound call → ElevenLabs API
//   2. Voice agent converses with the provider's receptionist
//   3. Voice agent invokes `book_appointment` tool via tool-calling
//   4. ElevenLabs POSTs tool call payload to /call-status webhook
//   5. Orchestrator processes the webhook and emits swarm events
// ═══════════════════════════════════════════════════════════════

// ─── Tool Call: book_appointment ────────────────────────────
//
// This is the tool the ElevenLabs voice agent will invoke when
// it has negotiated an appointment slot with the provider.
//
// Configured in the ElevenLabs agent dashboard under:
//   Agent → Tools → Custom Tool → "book_appointment"

/** Arguments passed by the voice agent when invoking book_appointment */
export interface BookAppointmentToolArgs {
  /** Name of the provider (e.g., "Dentist A") */
  provider_name: string;
  /** The offered time slot (e.g., "10:30 AM") */
  slot_time: string;
  /** Brief reasoning for selecting this slot (e.g., "Earliest slot after 9:30 AM") */
  reasoning: string;
}

/**
 * Full tool call envelope from ElevenLabs.
 *
 * ElevenLabs wraps tool invocations in this shape when sending
 * them to the configured webhook URL.
 *
 * Reference: https://elevenlabs.io/docs/agents-platform/overview
 */
export interface ElevenLabsToolCall {
  /** Unique ID for this tool invocation */
  tool_call_id: string;
  /** Always "book_appointment" for our use case */
  tool_name: "book_appointment";
  /** The structured arguments from the voice agent */
  parameters: BookAppointmentToolArgs;
}

// ─── Webhook: POST /call-status ─────────────────────────────
//
// ElevenLabs POSTs to this endpoint when:
//   1. A voice agent invokes a tool (tool_calls present)
//   2. A call ends (status changes)
//
// The orchestrator's webhook handler would:
//   - Parse this payload
//   - Match agent_id to the swarm's active agents
//   - Process booking logic
//   - Emit swarm:update / swarm:completed events

/** Payload shape received at POST /call-status */
export interface CallStatusWebhookPayload {
  /** The ElevenLabs conversation/call ID */
  conversation_id: string;
  /** Maps to our internal ProviderAgent.id */
  agent_id: string;
  /** Provider name for logging/verification */
  provider_name: string;
  /** The slot offered during the call (null if no slot discussed) */
  offered_slot: string | null;
  /** Whether the voice agent confirmed the booking */
  booking_confirmed: boolean;
  /** Tool calls made during this conversation turn */
  tool_calls: ElevenLabsToolCall[];
  /** Call lifecycle status */
  call_status: "in_progress" | "completed" | "failed" | "no_answer";
}

// ─── Outbound Call Request ──────────────────────────────────
//
// Shape used internally to initiate an ElevenLabs outbound call.
// In production, the orchestrator would build this and POST it
// to the ElevenLabs Conversational AI API.

/** Internal request shape for initiating an outbound voice call */
export interface OutboundCallRequest {
  /** Internal agent ID (e.g., "agent-1") */
  agent_id: string;
  /** ElevenLabs agent configuration ID (from dashboard) */
  elevenlabs_agent_id: string;
  /** Provider name for context injection */
  provider_name: string;
  /** The swarm this call belongs to */
  swarm_id: string;
  /** Phone number to dial (in production) */
  phone_number: string;
  /**
   * Dynamic prompt overrides injected into the voice agent.
   * Used to pass scheduling constraints (e.g., min time = 9:30 AM).
   */
  prompt_overrides: {
    /** Minimum acceptable appointment time */
    min_valid_time: string;
    /** Patient name for the appointment */
    patient_name: string;
    /** Appointment type (e.g., "dental cleaning") */
    appointment_type: string;
  };
}
