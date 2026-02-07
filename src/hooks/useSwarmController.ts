/**
 * useSwarmController — Orchestrates the swarm from the frontend perspective.
 *
 * FRONTEND RESPONSIBILITY:
 * This hook is a PURE EVENT CONSUMER. It does NOT contain any booking logic,
 * winner selection, or agent state management. All of that lives in the
 * SwarmOrchestrator (backend).
 *
 * In production, this hook would:
 *   1. POST /start-swarm to kick off the swarm
 *   2. Listen to Socket.io events for real-time updates
 *   3. Render whatever the server tells it to render
 *
 * Migration to real backend:
 *   - Replace `new SwarmOrchestrator().start()` → `fetch('/api/start-swarm', { method: 'POST' })`
 *   - Replace `eventBus.on()` → `socket.on()` (via useRealtimeEvents)
 *   - No other changes required
 */

import { useState, useCallback, useRef } from "react";
import { SwarmOrchestrator } from "@/backend/SwarmOrchestrator";
import { useRealtimeEvents } from "./useRealtimeEvents";
import type {
  ProviderAgent,
  SwarmStartPayload,
  SwarmUpdatePayload,
  SwarmCompletedPayload,
} from "@/backend/types";

export interface SwarmControllerResult {
  agents: ProviderAgent[];
  winner: ProviderAgent | null;
  isRunning: boolean;
  logs: string[];
  startSwarm: () => void;
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

  // ── Subscribe to backend events (read-only consumption) ──

  // swarm:start — Initialize agent list
  useRealtimeEvents("swarm:start", (payload) => {
    const data = payload as SwarmStartPayload;
    setAgents(data.agents);
    addLog("🚀 Swarm initiated — dispatching 5 AI agents...");
    addLog(`📡 Swarm ID: ${data.swarmId}`);
  });

  // swarm:update — Individual agent status change
  useRealtimeEvents("swarm:update", (payload) => {
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

  // swarm:completed — Backend resolved the winner
  useRealtimeEvents("swarm:completed", (payload) => {
    const data = payload as SwarmCompletedPayload;

    // Apply final agent state from the server
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

  // ── Actions ────────────────────────────────────────────────

  const startSwarm = useCallback(() => {
    // Clean up previous run
    orchestratorRef.current?.cleanup();

    setIsRunning(true);
    setWinner(null);
    setLogs([]);
    setAgents([]);

    /**
     * In production, replace with:
     *   await fetch('/api/start-swarm', { method: 'POST' });
     * The server would create the orchestrator and emit events
     * over the Socket.io connection this client is subscribed to.
     */
    const orchestrator = new SwarmOrchestrator();
    orchestratorRef.current = orchestrator;
    orchestrator.start();
  }, []);

  const reset = useCallback(() => {
    orchestratorRef.current?.cleanup();
    orchestratorRef.current = null;
    setAgents([]);
    setWinner(null);
    setIsRunning(false);
    setLogs([]);
  }, []);

  return { agents, winner, isRunning, logs, startSwarm, reset };
}
