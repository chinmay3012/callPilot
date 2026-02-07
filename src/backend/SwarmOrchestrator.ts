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
 * 
 * The simulation preserves identical event shapes and timing behavior.
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

// --- Provider configuration ---
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

// --- Utilities ---
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

// --- Orchestrator ---
export class SwarmOrchestrator {
  private timeouts: number[] = [];
  private swarmId: string | null = null;
  private winnerSelected = false;

  /**
   * POST /start-swarm
   * Kicks off parallel agent calls and emits real-time updates.
   */
  start(): void {
    this.cleanup();
    this.winnerSelected = false;
    this.swarmId = generateSwarmId();

    const agents: ProviderAgent[] = PROVIDER_CONFIG.map((p) => ({
      ...p,
      status: "searching" as const,
      slotTime: null,
    }));

    // Emit swarm:start (equivalent to Socket.io room broadcast)
    const startPayload: SwarmStartPayload = {
      swarmId: this.swarmId,
      agents,
      timestamp: Date.now(),
    };
    eventBus.emit("swarm:start", startPayload);

    const delays = agents.map(() => randomDelay());
    const slots = agents.map(() => randomSlot());
    const minTime = parseTime(MIN_VALID_TIME);
    let completedCount = 0;

    agents.forEach((agent, i) => {
      const baseDelay = delays[i];
      const slot = slots[i];

      // Phase 1: Calling (30% through delay)
      this.schedule(baseDelay * 0.3, () => {
        if (this.winnerSelected) return;
        this.emitUpdate(agent.id, "calling", null, `📞 ${agent.name}: Dialing provider...`);
      });

      // Phase 2: Negotiating (65% through delay)
      this.schedule(baseDelay * 0.65, () => {
        if (this.winnerSelected) return;
        this.emitUpdate(agent.id, "negotiating", slot, `🤝 ${agent.name}: Negotiating — offered ${slot}`);
      });

      // Phase 3: Result (full delay)
      this.schedule(baseDelay, () => {
        completedCount++;
        const isValid = parseTime(slot) >= minTime;

        if (this.winnerSelected) {
          // Another agent already won — cancel this one
          this.emitUpdate(agent.id, "cancelled", slot, `⏹️ ${agent.name}: Cancelled (winner already selected)`);
        } else if (isValid) {
          this.emitUpdate(agent.id, "booked", slot, `✅ ${agent.name}: Slot ${slot} accepted`);
        } else {
          this.emitUpdate(agent.id, "rejected", slot, `❌ ${agent.name}: Slot ${slot} rejected (before 9:30 AM)`);
        }

        // Check completion after a short settle
        this.schedule(300, () => this.checkCompletion(agents.length, completedCount));
      });
    });
  }

  /**
   * Evaluate all results and pick the winner.
   * 
   * BOOKING LOGIC (mirrors real agent decision engine):
   *   1. Filter agents with status "booked"
   *   2. Find earliest valid slot
   *   3. Mark winner; cancel/reject all others
   */
  private checkCompletion(total: number, completed: number): void {
    if (completed < total || this.winnerSelected) return;
    this.winnerSelected = true;

    // Gather current state from event history
    // In simulation we reconstruct from what we emitted
    // In production the server has authoritative state
    eventBus.emit("swarm:request-state", { swarmId: this.swarmId });
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
  }
}
