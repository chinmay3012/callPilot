/**
 * useSwarmController — The SOLE interface between the UI and the backend.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  ARCHITECTURE BOUNDARY
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This hook is the ONLY place in the frontend that may import from
 * `src/backend/*`. All other components, hooks, and pages MUST interact
 * with the swarm exclusively through this controller's return value.
 *
 * Think of this as the "client SDK" for the swarm service:
 *
 *   ┌──────────────┐       ┌──────────────────┐       ┌────────────────┐
 *   │   UI Layer   │ ───▶  │ SwarmController  │ ───▶  │   Backend      │
 *   │  (React)     │       │ (this hook)      │       │ (Orchestrator) │
 *   └──────────────┘       └──────────────────┘       └────────────────┘
 *       reads state           owns lifecycle            emits events
 *       calls actions         subscribes to events      runs agents
 *
 * ─── Migration to real backend ─────────────────────────────────────────
 *
 * When moving to a real Node.js + Socket.io backend:
 *
 *   1. Replace `new SwarmOrchestrator().start()`
 *      → `fetch('/api/start-swarm', { method: 'POST' })`
 *
 *   2. Replace `eventBus.on('swarm:*', ...)`
 *      → `socket.on('swarm:*', ...)`
 *
 *   3. Replace `orchestratorRef.current?.cleanup()`
 *      → `fetch('/api/cancel-swarm', { method: 'POST' })`
 *        or `socket.emit('cancel-swarm')`
 *
 *   No UI changes required — the return type stays identical.
 *
 * ─── ElevenLabs integration (future) ───────────────────────────────────
 *
 *   The real backend would use ElevenLabs Conversational AI to:
 *     - Initiate outbound voice calls per agent
 *     - Receive slot offers via tool-calling webhooks
 *     - Emit the same event shapes this controller already consumes
 *
 *   This controller needs zero changes for that integration.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef, useEffect } from "react";

// ── Backend imports (ONLY allowed in this file) ──────────────────────
import { SwarmOrchestrator } from "@/backend/SwarmOrchestrator";
import { eventBus } from "@/backend/EventBus";
import type {
  ProviderAgent,
  SwarmStartPayload,
  SwarmUpdatePayload,
  SwarmCompletedPayload,
} from "@/backend/types";

// ── Public types (re-exported for consumers) ─────────────────────────
export type { ProviderAgent } from "@/backend/types";

/**
 * The public API surface of the swarm controller.
 * UI components should only depend on this interface.
 */
export interface SwarmControllerResult {
  /** Current state of all provider agents */
  agents: ProviderAgent[];
  /** The winning agent (null until swarm completes with a valid booking) */
  winner: ProviderAgent | null;
  /** Whether the swarm is currently running */
  isRunning: boolean;
  /** Chronological log of swarm events */
  logs: string[];
  /**
   * Kick off a new swarm run.
   * Production: POST /api/start-swarm
   */
  startSwarm: () => void;
  /**
   * Cancel and reset the current swarm.
   * Production: POST /api/cancel-swarm + clear local state
   */
  reset: () => void;
}

export function useSwarmController(): SwarmControllerResult {
  const [agents, setAgents] = useState<ProviderAgent[]>([]);
  const [winner, setWinner] = useState<ProviderAgent | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const orchestratorRef = useRef<SwarmOrchestrator | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // ── Event subscriptions ─────────────────────────────────────────────
  // These inline subscriptions replace the previous useRealtimeEvents hook.
  // In production, swap `eventBus.on(...)` → `socket.on(...)`.
  // The handler shapes remain identical.

  useEffect(() => {
    /**
     * swarm:start — Backend initialized agents and assigned a swarm ID.
     * Production: Socket.io emits this after POST /api/start-swarm resolves.
     */
    const unsubStart = eventBus.on("swarm:start", (payload: unknown) => {
      const data = payload as SwarmStartPayload;
      setAgents(data.agents);
      addLog("🚀 Swarm initiated — dispatching 5 AI agents...");
      addLog(`📡 Swarm ID: ${data.swarmId}`);
    });

    /**
     * swarm:update — A single agent's status changed.
     * Production: Socket.io emits this as each voice call progresses.
     */
    const unsubUpdate = eventBus.on("swarm:update", (payload: unknown) => {
      const data = payload as SwarmUpdatePayload;

      setAgents((prev) =>
        prev.map((a) =>
          a.id === data.agentId
            ? { ...a, status: data.status, slotTime: data.slotTime ?? a.slotTime }
            : a
        )
      );

      if (data.message) {
        addLog(data.message);
      }
    });

    /**
     * swarm:completed — Backend resolved the swarm (winner or no-result).
     * Production: Socket.io emits this with final state + booking confirmation.
     */
    const unsubCompleted = eventBus.on("swarm:completed", (payload: unknown) => {
      const data = payload as SwarmCompletedPayload;

      // Apply authoritative final state from the server
      setAgents(data.allAgents);
      setIsRunning(false);

      if (data.winnerId && data.winnerName && data.winnerSlot) {
        const winnerAgent = data.allAgents.find((a) => a.id === data.winnerId) ?? null;
        setWinner(winnerAgent);
        addLog(`🏆 Winner: ${data.winnerName} at ${data.winnerSlot}`);
      } else {
        addLog("⚠️ No valid slots found. Try again.");
      }
    });

    // Cleanup all subscriptions on unmount
    return () => {
      unsubStart();
      unsubUpdate();
      unsubCompleted();
    };
  }, [addLog]);

  // ── Actions ─────────────────────────────────────────────────────────

  const startSwarm = useCallback(() => {
    // Clean up any previous run
    orchestratorRef.current?.cleanup();

    setIsRunning(true);
    setWinner(null);
    setLogs([]);
    setAgents([]);

    /**
     * Production replacement:
     *   await fetch('/api/start-swarm', { method: 'POST' });
     *
     * The server would create the orchestrator, initiate ElevenLabs
     * voice calls, and emit events over Socket.io. This client would
     * receive them through the subscriptions above.
     */
    const orchestrator = new SwarmOrchestrator();
    orchestratorRef.current = orchestrator;
    orchestrator.start();
  }, []);

  const reset = useCallback(() => {
    /**
     * Production replacement:
     *   await fetch('/api/cancel-swarm', { method: 'POST' });
     *   socket.emit('cancel-swarm');
     *
     * The server would terminate active calls and clean up resources.
     */
    orchestratorRef.current?.cleanup();
    orchestratorRef.current = null;
    setAgents([]);
    setWinner(null);
    setIsRunning(false);
    setLogs([]);
  }, []);

  return { agents, winner, isRunning, logs, startSwarm, reset };
}
