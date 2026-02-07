/**
 * SwarmOrchestrator — Simulates the Node.js backend orchestrator.
 *
 * BACKEND RESPONSIBILITY:
 * In production, this entire module runs on the server.
 * It would:
 *   1. Spawn real AI voice agents (ElevenLabs) for each provider
 *   2. Manage parallel outbound calls
 *   3. Receive webhook callbacks with slot offers
 *   4. Apply booking logic and emit results via Socket.io
 *   5. Write confirmed bookings to the database
 *
 * The simulation preserves identical event shapes and timing behavior.
 *
 * ─── Integration Points ───────────────────────────────────
 *
 * ElevenLabs Voice Calls:
 *   In production, each agent would trigger an outbound call via
 *   the ElevenLabs Conversational AI API. The agent would use
 *   tool-calling to report the offered slot back to this orchestrator.
 *
 * Webhook Callbacks:
 *   POST /call-status would receive slot offers from voice agents.
 *   The orchestrator would process them identically to the simulation.
 *
 * Database Writes:
 *   Confirmed bookings would be persisted via Supabase/Postgres
 *   before emitting the swarm:completed event.
 */

import { eventBus } from "./EventBus";
import type {
  ProviderAgent,
  AgentStatus,
  SwarmStartPayload,
  SwarmUpdatePayload,
  SwarmCompletedPayload,
  AgentBookedPayload,
} from "./types";

// ─── Provider Configuration ─────────────────────────────────
const PROVIDER_CONFIG: Omit<ProviderAgent, "status" | "slotTime">[] = [
  { id: "agent-1", name: "Dentist A", elevenlabsReady: true },
  { id: "agent-2", name: "Dentist B", elevenlabsReady: false },
  { id: "agent-3", name: "Dentist C", elevenlabsReady: false },
  { id: "agent-4", name: "Dentist D", elevenlabsReady: false },
  { id: "agent-5", name: "Dentist E", elevenlabsReady: false },
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
   * Authoritative agent state — owned by the orchestrator.
   * In production this lives in server memory / Redis.
   */
  private agents: ProviderAgent[] = [];

  /**
   * POST /start-swarm
   * Kicks off parallel agent calls and emits real-time updates.
   *
   * In production:
   *   - Each agent would initiate an ElevenLabs outbound voice call
   *   - The voice agent uses tool-calling to POST slot offers to /call-status
   *   - This method would return the swarmId for the client to subscribe to
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

    // ── Simulate parallel agent calls ──
    const delays = this.agents.map(() => randomDelay());
    const slots = this.agents.map(() => randomSlot());
    const minTime = parseTime(MIN_VALID_TIME);
    let completedCount = 0;

    this.agents.forEach((agent, i) => {
      const baseDelay = delays[i];
      const slot = slots[i];

      /**
       * Phase 1: Calling (30% through delay)
       * Production: ElevenLabs call connected, agent greeting sent
       */
      this.schedule(baseDelay * 0.3, () => {
        if (this.winnerSelected) return;
        this.updateAgent(agent.id, "calling", null);
        this.emitUpdate(agent.id, "calling", null, `📞 ${agent.name}: Dialing provider...`);
      });

      /**
       * Phase 2: Negotiating (65% through delay)
       * Production: Voice agent received slot offer via tool-calling
       */
      this.schedule(baseDelay * 0.65, () => {
        if (this.winnerSelected) return;
        this.updateAgent(agent.id, "negotiating", slot);
        this.emitUpdate(agent.id, "negotiating", slot, `🤝 ${agent.name}: Negotiating — offered ${slot}`);
      });

      /**
       * Phase 3: Result (full delay)
       * Production: POST /call-status webhook received from ElevenLabs tool call
       */
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

      // Cancel non-winners
      this.agents = this.agents.map((a) => {
        if (a.id === winner.id) return { ...a, status: "booked" as AgentStatus };
        if (a.status === "booked") {
          this.emitUpdate(a.id, "cancelled", a.slotTime, `⏹️ ${a.name}: Cancelled (not earliest slot)`);
          return { ...a, status: "cancelled" as AgentStatus };
        }
        return a;
      });

      // Emit agent:booked (would go to webhook in production)
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
    this.agents = [];
  }
}
