/**
 * useSwarmController — Orchestrates the swarm from the frontend perspective.
 * 
 * FRONTEND RESPONSIBILITY:
 * Consumes events from the backend simulation and maintains UI state.
 * In production, this hook would only listen to Socket.io events —
 * the SwarmOrchestrator would run on the server.
 * 
 * ElevenLabs Integration Points:
 *   - Agents marked with elevenlabsReady=true would trigger real outbound calls
 *   - The "agent:booked" event would come from an ElevenLabs webhook
 *   - Tool calling would POST to /call-status on the backend
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { SwarmOrchestrator } from "@/backend/SwarmOrchestrator";
import { useRealtimeEvents } from "./useRealtimeEvents";
import type {
  ProviderAgent,
  AgentStatus,
  SwarmStartPayload,
  SwarmUpdatePayload,
} from "@/backend/types";

export interface SwarmControllerResult {
  agents: ProviderAgent[];
  winner: ProviderAgent | null;
  isRunning: boolean;
  logs: string[];
  startSwarm: () => void;
  reset: () => void;
}

function parseTime(t: string): number {
  const [time, period] = t.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

export function useSwarmController(): SwarmControllerResult {
  const [agents, setAgents] = useState<ProviderAgent[]>([]);
  const [winner, setWinner] = useState<ProviderAgent | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const orchestratorRef = useRef<SwarmOrchestrator | null>(null);
  const { on, emit } = useRealtimeEvents();

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // Subscribe to backend events
  useEffect(() => {
    // swarm:start — Initialize agent list
    const unsubStart = on("swarm:start", (payload) => {
      const data = payload as SwarmStartPayload;
      setAgents(data.agents);
      addLog("🚀 Swarm initiated — dispatching 5 AI agents...");
      addLog(`📡 Swarm ID: ${data.swarmId}`);
    });

    // swarm:update — Individual agent status change
    const unsubUpdate = on("swarm:update", (payload) => {
      const data = payload as SwarmUpdatePayload;

      setAgents((prev) =>
        prev.map((a) =>
          a.id === data.agentId
            ? { ...a, status: data.status, slotTime: data.slotTime }
            : a
        )
      );

      if (data.message) {
        addLog(data.message);
      }
    });

    // swarm:request-state — Orchestrator asks us to evaluate winner
    // (In production, the server does this — here we handle it client-side)
    const unsubRequestState = on("swarm:request-state", () => {
      setAgents((current) => {
        const booked = current.filter(
          (a) => a.status === "booked" && a.slotTime
        );

        if (booked.length > 0) {
          const best = booked.reduce((a, b) =>
            parseTime(a.slotTime!) <= parseTime(b.slotTime!) ? a : b
          );

          setWinner(best);
          addLog(`🏆 Winner: ${best.name} at ${best.slotTime}`);

          // Emit agent:booked event (would go to webhook in production)
          emit("agent:booked", {
            swarmId: "",
            agentId: best.id,
            providerName: best.name,
            slotTime: best.slotTime,
          });

          // Cancel non-winners
          const updated = current.map((a) => {
            if (a.id === best.id) return { ...a, status: "booked" as AgentStatus };
            if (a.status === "booked") return { ...a, status: "cancelled" as AgentStatus };
            return a;
          });

          setIsRunning(false);
          emit("swarm:completed", {
            swarmId: "",
            winnerId: best.id,
            winnerName: best.name,
            winnerSlot: best.slotTime,
            allAgents: updated,
          });

          return updated;
        } else {
          addLog("⚠️ No valid slots found. Try again.");
          setIsRunning(false);
          emit("swarm:completed", {
            swarmId: "",
            winnerId: null,
            winnerName: null,
            winnerSlot: null,
            allAgents: current,
          });
          return current;
        }
      });
    });

    return () => {
      unsubStart();
      unsubUpdate();
      unsubRequestState();
    };
  }, [on, emit, addLog]);

  const startSwarm = useCallback(() => {
    // Clean up previous run
    orchestratorRef.current?.cleanup();

    setIsRunning(true);
    setWinner(null);
    setLogs([]);
    setAgents([]);

    // Create orchestrator and start (simulates POST /start-swarm)
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
