/**
 * SwarmOrchestrator — Simulates the Node.js backend orchestrator.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  BACKEND RESPONSIBILITY — Runs on the server in production
 * ═══════════════════════════════════════════════════════════════════════
 *
 * In production, this module:
 *   1. Spawns real ElevenLabs voice agents for each provider
 *   2. Manages parallel outbound calls via the ElevenLabs API
 *   3. Receives webhook callbacks at POST /call-status with tool call results
 *   4. Applies booking logic and emits results via Socket.io
 *   5. Writes confirmed bookings to the database
 *
 * The simulation preserves identical event shapes and timing behavior.
 *
 * ─── ElevenLabs Integration Points ────────────────────────────────────
 *
 * This file contains clearly marked integration points where the
 * simulation will be replaced with real ElevenLabs API calls:
 *
 *   🔌 INTEGRATION POINT: OUTBOUND CALL
 *      → Where each agent's voice call is initiated
 *      → Replace setTimeout simulation with ElevenLabs API call
 *
 *   🔌 INTEGRATION POINT: WEBHOOK HANDLER
 *      → Where POST /call-status receives tool call results
 *      → Replace simulated delays with real webhook processing
 *
 *   🔌 INTEGRATION POINT: CALL TEARDOWN
 *      → Where remaining calls are terminated after winner selection
 *      → Replace with ElevenLabs call hangup API
 *
 * See src/backend/elevenlabs.config.ts for:
 *   - Voice agent persona and system prompt
 *   - Tool definitions (book_appointment)
 *   - Provider readiness flags
 *   - Webhook configuration
 *
 * See src/backend/types.ts for:
 *   - BookAppointmentToolArgs (tool call contract)
 *   - CallStatusWebhookPayload (webhook shape)
 *   - OutboundCallRequest (call initiation shape)
 * ═══════════════════════════════════════════════════════════════════════
 */

import { eventBus } from "./EventBus";
import { ELEVENLABS_PROVIDER_CONFIG } from "./elevenlabs.config";
import type {
  ProviderAgent,
  AgentStatus,
  SwarmStartPayload,
  SwarmUpdatePayload,
  SwarmCompletedPayload,
  AgentBookedPayload,
  CallStatusWebhookPayload,
  OutboundCallRequest,
} from "./types";

// ─── Provider Configuration ─────────────────────────────────
const PROVIDER_CONFIG: Omit<ProviderAgent, "status" | "slotTime">[] = [
  { id: "agent-1", name: "Dentist A", elevenlabsReady: ELEVENLABS_PROVIDER_CONFIG["agent-1"].elevenlabsReady },
  { id: "agent-2", name: "Dentist B", elevenlabsReady: ELEVENLABS_PROVIDER_CONFIG["agent-2"].elevenlabsReady },
  { id: "agent-3", name: "Dentist C", elevenlabsReady: ELEVENLABS_PROVIDER_CONFIG["agent-3"].elevenlabsReady },
  { id: "agent-4", name: "Dentist D", elevenlabsReady: ELEVENLABS_PROVIDER_CONFIG["agent-4"].elevenlabsReady },
  { id: "agent-5", name: "Dentist E", elevenlabsReady: ELEVENLABS_PROVIDER_CONFIG["agent-5"].elevenlabsReady },
];

const MOCK_SLOTS = [
  "8:00 AM", "8:30 AM", "9:00 AM", "9:15 AM", "9:30 AM",
  "10:00 AM", "10:30 AM", "11:00 AM", "11:45 AM",
  "1:00 PM", "2:15 PM", "3:00 PM", "4:30 PM",
];

const MIN_VALID_TIME = "9:30 AM";

// ─── Utilities ──────────────────────────────────────────────
function parseTime(t: string): number {
  const [time, period] = t.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function randomSlot(): string {
  return MOCK_SLOTS[Math.floor(Math.random() * MOCK_SLOTS.length)];
}

function randomDelay(): number {
  return 1000 + Math.random() * 4000;
}

function generateSwarmId(): string {
  return `swarm-${Date.now().toString(36)}`;
}

// ─── Orchestrator ───────────────────────────────────────────
export class SwarmOrchestrator {
  private timeouts: number[] = [];
  private swarmId: string | null = null;
  private winnerSelected = false;

  /**
   * Tracks how many agents have reported results via webhook.
   * Used by processWebhookResult() to know when all agents are done.
   * Not used during simulation (simulation tracks its own completedCount).
   */
  private webhookCompletedCount = 0;

  /**
   * Authoritative agent state — owned by the orchestrator.
   * In production this lives in server memory / Redis.
   */
  private agents: ProviderAgent[] = [];

  /**
   * POST /start-swarm
   * Kicks off parallel agent calls and emits real-time updates.
   *
   * ── ElevenLabs Integration ──────────────────────────────────
   * In production, this method would:
   *   1. Loop through agents
   *   2. For agents with elevenlabsReady === true:
   *      → Build an OutboundCallRequest
   *      → POST to ElevenLabs Conversational AI API to initiate call
   *      → The voice agent handles the conversation autonomously
   *      → Tool calls arrive via POST /call-status webhook
   *   3. For agents with elevenlabsReady === false:
   *      → Continue using simulation (or skip)
   *   4. Return the swarmId for the client to subscribe to
   */
  start(): void {
    this.cleanup();
    this.winnerSelected = false;
    this.swarmId = generateSwarmId();

    this.agents = PROVIDER_CONFIG.map((p) => ({
      ...p,
      status: "searching" as const,
      slotTime: null,
    }));

    // Emit swarm:start (equivalent to Socket.io room broadcast)
    const startPayload: SwarmStartPayload = {
      swarmId: this.swarmId,
      agents: this.agents,
      timestamp: Date.now(),
    };
    eventBus.emit("swarm:start", startPayload);

    // ── Dispatch agents ──────────────────────────────────────
    const minTime = parseTime(MIN_VALID_TIME);
    let completedCount = 0;

    this.agents.forEach((agent) => {
      // ┌─────────────────────────────────────────────────────┐
      // │ 🔌 INTEGRATION POINT: OUTBOUND CALL                │
      // │                                                     │
      // │ When elevenlabsReady === true, replace the entire   │
      // │ simulation block below with:                        │
      // │                                                     │
      // │   const callRequest: OutboundCallRequest = {        │
      // │     agent_id: agent.id,                             │
      // │     elevenlabs_agent_id:                            │
      // │       ELEVENLABS_PROVIDER_CONFIG[agent.id]          │
      // │         .elevenlabsAgentId,                         │
      // │     provider_name: agent.name,                      │
      // │     swarm_id: this.swarmId,                         │
      // │     phone_number:                                   │
      // │       ELEVENLABS_PROVIDER_CONFIG[agent.id]          │
      // │         .phoneNumber,                               │
      // │     prompt_overrides: {                             │
      // │       min_valid_time: MIN_VALID_TIME,               │
      // │       patient_name: "John Doe",                     │
      // │       appointment_type: "dental cleaning",          │
      // │     },                                              │
      // │   };                                                │
      // │                                                     │
      // │   await elevenlabsAPI.initiateOutboundCall(          │
      // │     callRequest                                     │
      // │   );                                                │
      // │                                                     │
      // │ The voice agent then handles the call autonomously. │
      // │ Results arrive via POST /call-status webhook.       │
      // └─────────────────────────────────────────────────────┘

      const baseDelay = randomDelay();
      const slot = randomSlot();

      // Phase 1: Calling (30% through delay)
      // Production: ElevenLabs call connected, agent greeting sent
      this.schedule(baseDelay * 0.3, () => {
        if (this.winnerSelected) return;
        this.updateAgent(agent.id, "calling", null);
        this.emitUpdate(agent.id, "calling", null, `📞 ${agent.name}: Dialing provider...`);
      });

      // Phase 2: Negotiating (65% through delay)
      // Production: Voice agent received slot offer via conversation
      this.schedule(baseDelay * 0.65, () => {
        if (this.winnerSelected) return;
        this.updateAgent(agent.id, "negotiating", slot);
        this.emitUpdate(agent.id, "negotiating", slot, `🤝 ${agent.name}: Negotiating — offered ${slot}`);
      });

      // Phase 3: Result (full delay)
      // ┌─────────────────────────────────────────────────────┐
      // │ 🔌 INTEGRATION POINT: WEBHOOK HANDLER              │
      // │                                                     │
      // │ In production, this phase is replaced by the        │
      // │ POST /call-status webhook handler. When ElevenLabs  │
      // │ voice agent invokes the book_appointment tool:      │
      // │                                                     │
      // │   1. ElevenLabs POSTs CallStatusWebhookPayload to   │
      // │      /call-status                                   │
      // │   2. Webhook handler calls                          │
      // │      processWebhookResult() with the payload        │
      // │   3. Booking logic runs identically to below        │
      // │                                                     │
      // │ The webhook payload shape is defined in types.ts:   │
      // │   CallStatusWebhookPayload                          │
      // │                                                     │
      // │ The tool call shape is defined in types.ts:         │
      // │   ElevenLabsToolCall / BookAppointmentToolArgs      │
      // └─────────────────────────────────────────────────────┘
      this.schedule(baseDelay, () => {
        completedCount++;
        const isValid = parseTime(slot) >= minTime;

        if (this.winnerSelected) {
          this.updateAgent(agent.id, "cancelled", slot);
          this.emitUpdate(agent.id, "cancelled", slot, `⏹️ ${agent.name}: Cancelled (winner already selected)`);
        } else if (isValid) {
          this.updateAgent(agent.id, "booked", slot);
          this.emitUpdate(agent.id, "booked", slot, `✅ ${agent.name}: Slot ${slot} accepted`);
        } else {
          this.updateAgent(agent.id, "rejected", slot);
          this.emitUpdate(agent.id, "rejected", slot, `❌ ${agent.name}: Slot ${slot} rejected (before 9:30 AM)`);
        }

        // Check completion after a short settle
        this.schedule(300, () => this.evaluateAndComplete(completedCount));
      });
    });
  }

  /**
   * Process a webhook result from ElevenLabs.
   *
   * ┌─────────────────────────────────────────────────────────┐
   * │ 🔌 INTEGRATION POINT: WEBHOOK PROCESSING               │
   * │                                                         │
   * │ In production, the POST /call-status route handler      │
   * │ (see webhookHandler.ts) calls this method with the      │
   * │ validated CallStatusWebhookPayload.                     │
   * │                                                         │
   * │ This method is NOT called during simulation. It exists  │
   * │ as production-ready logic that processes real webhook    │
   * │ payloads and emits the SAME events as the simulation.   │
   * │                                                         │
   * │ Event parity:                                           │
   * │   Simulation emits → swarm:update, agent:booked,        │
   * │                       swarm:completed                   │
   * │   Webhook emits    → swarm:update, agent:booked,        │
   * │                       swarm:completed                   │
   * │   Identical. No UI changes needed.                      │
   * └─────────────────────────────────────────────────────────┘
   */
  processWebhookResult(payload: CallStatusWebhookPayload): void {
    const agent = this.agents.find((a) => a.id === payload.agent_id);
    if (!agent) {
      console.error(`[Webhook] Unknown agent_id: ${payload.agent_id}`);
      return;
    }

    // ── Handle call failure / no answer ──────────────────────
    if (payload.call_status === "failed" || payload.call_status === "no_answer") {
      this.updateAgent(payload.agent_id, "rejected", null);
      this.emitUpdate(
        payload.agent_id,
        "rejected",
        null,
        `❌ ${agent.name}: Call ${payload.call_status === "failed" ? "failed" : "not answered"}`
      );
      this.webhookCompletedCount++;
      this.evaluateAndComplete(this.webhookCompletedCount);
      return;
    }

    // ── Extract tool call ────────────────────────────────────
    const toolCall = payload.tool_calls.find(
      (tc) => tc.tool_name === "book_appointment"
    );

    if (!toolCall) {
      // Call completed without invoking book_appointment — no slot found
      this.updateAgent(payload.agent_id, "rejected", payload.offered_slot);
      this.emitUpdate(
        payload.agent_id,
        "rejected",
        payload.offered_slot,
        `❌ ${agent.name}: No valid slot offered`
      );
      this.webhookCompletedCount++;
      this.evaluateAndComplete(this.webhookCompletedCount);
      return;
    }

    // ── Process the booking tool call ────────────────────────
    const { slot_time, reasoning } = toolCall.parameters;
    const minTime = parseTime(MIN_VALID_TIME);
    const isValid = parseTime(slot_time) >= minTime;

    if (this.winnerSelected) {
      this.updateAgent(payload.agent_id, "cancelled", slot_time);
      this.emitUpdate(
        payload.agent_id,
        "cancelled",
        slot_time,
        `⏹️ ${agent.name}: Cancelled (winner already selected)`
      );
    } else if (isValid && payload.booking_confirmed) {
      this.updateAgent(payload.agent_id, "booked", slot_time);
      this.emitUpdate(
        payload.agent_id,
        "booked",
        slot_time,
        `✅ ${agent.name}: Slot ${slot_time} accepted — ${reasoning}`
      );
    } else {
      this.updateAgent(payload.agent_id, "rejected", slot_time);
      this.emitUpdate(
        payload.agent_id,
        "rejected",
        slot_time,
        `❌ ${agent.name}: Slot ${slot_time} rejected (${isValid ? "not confirmed" : "before 9:30 AM"})`
      );
    }

    this.webhookCompletedCount++;
    this.evaluateAndComplete(this.webhookCompletedCount);
  }

  /**
   * Build an outbound call request for a provider (placeholder).
   *
   * In production, this would be called for each agent with
   * elevenlabsReady === true during start().
   */
  private buildOutboundCallRequest(agent: ProviderAgent): OutboundCallRequest {
    const config = ELEVENLABS_PROVIDER_CONFIG[agent.id as keyof typeof ELEVENLABS_PROVIDER_CONFIG];

    return {
      agent_id: agent.id,
      elevenlabs_agent_id: config.elevenlabsAgentId ?? "",
      provider_name: agent.name,
      swarm_id: this.swarmId!,
      phone_number: config.phoneNumber,
      prompt_overrides: {
        min_valid_time: MIN_VALID_TIME,
        patient_name: "John Doe", // Would come from user input
        appointment_type: "dental cleaning", // Would come from user input
      },
    };
  }

  /**
   * BOOKING LOGIC (mirrors real agent decision engine):
   *   1. Wait for all agents to finish
   *   2. Filter agents with status "booked"
   *   3. Find earliest valid slot
   *   4. Mark winner; cancel all others
   *   5. Emit swarm:completed with final state
   *
   * In production:
   *   - This would also write the booking to the database
   *   - Send confirmation email/SMS to the patient
   *   - Hang up remaining active calls via ElevenLabs API
   */
  private evaluateAndComplete(completed: number): void {
    if (completed < this.agents.length || this.winnerSelected) return;
    this.winnerSelected = true;

    const booked = this.agents.filter(
      (a) => a.status === "booked" && a.slotTime
    );

    if (booked.length > 0) {
      // Pick earliest valid slot
      const winner = booked.reduce((a, b) =>
        parseTime(a.slotTime!) <= parseTime(b.slotTime!) ? a : b
      );

      // ┌─────────────────────────────────────────────────────┐
      // │ 🔌 INTEGRATION POINT: CALL TEARDOWN                │
      // │                                                     │
      // │ In production, after selecting a winner:            │
      // │                                                     │
      // │   for (const agent of nonWinnerAgents) {            │
      // │     if (agent.elevenlabsReady) {                    │
      // │       await elevenlabsAPI.endConversation(           │
      // │         agent.conversationId                        │
      // │       );                                            │
      // │     }                                               │
      // │   }                                                 │
      // │                                                     │
      // │ This ensures active voice calls are hung up         │
      // │ immediately after the winner is confirmed.          │
      // └─────────────────────────────────────────────────────┘

      // Cancel non-winners
      this.agents = this.agents.map((a) => {
        if (a.id === winner.id) return { ...a, status: "booked" as AgentStatus };
        if (a.status === "booked") {
          this.emitUpdate(a.id, "cancelled", a.slotTime, `⏹️ ${a.name}: Cancelled (not earliest slot)`);
          return { ...a, status: "cancelled" as AgentStatus };
        }
        return a;
      });

      // Emit agent:booked (would go to database write in production)
      const bookedPayload: AgentBookedPayload = {
        swarmId: this.swarmId!,
        agentId: winner.id,
        providerName: winner.name,
        slotTime: winner.slotTime!,
      };
      eventBus.emit("agent:booked", bookedPayload);

      // Emit swarm:completed with full state
      const completedPayload: SwarmCompletedPayload = {
        swarmId: this.swarmId!,
        winnerId: winner.id,
        winnerName: winner.name,
        winnerSlot: winner.slotTime,
        allAgents: [...this.agents],
      };
      eventBus.emit("swarm:completed", completedPayload);
    } else {
      const completedPayload: SwarmCompletedPayload = {
        swarmId: this.swarmId!,
        winnerId: null,
        winnerName: null,
        winnerSlot: null,
        allAgents: [...this.agents],
      };
      eventBus.emit("swarm:completed", completedPayload);
    }
  }

  // ─── Internal helpers ──────────────────────────────────────

  private updateAgent(agentId: string, status: AgentStatus, slotTime: string | null): void {
    this.agents = this.agents.map((a) =>
      a.id === agentId ? { ...a, status, slotTime: slotTime ?? a.slotTime } : a
    );
  }

  private emitUpdate(agentId: string, status: AgentStatus, slotTime: string | null, message: string): void {
    const payload: SwarmUpdatePayload = {
      swarmId: this.swarmId!,
      agentId,
      status,
      slotTime,
      message,
    };
    eventBus.emit("swarm:update", payload);
  }

  private schedule(delay: number, fn: () => void): void {
    const id = window.setTimeout(fn, delay);
    this.timeouts.push(id);
  }

  cleanup(): void {
    this.timeouts.forEach(clearTimeout);
    this.timeouts = [];
    this.swarmId = null;
    this.winnerSelected = false;
    this.webhookCompletedCount = 0;
    this.agents = [];
  }
}
