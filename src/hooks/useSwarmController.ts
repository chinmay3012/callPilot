/**
 * useSwarmController — The SOLE interface between the UI and the backend.
 *
 * Uses the Python FastAPI backend when available (POST + WebSocket).
 * Falls back to in-browser simulation if the API is unreachable.
 */

import { useState, useCallback, useRef, useEffect } from "react";

import { SwarmOrchestrator } from "@/backend/SwarmOrchestrator";
import { eventBus } from "@/backend/EventBus";
import type {
  ProviderAgent,
  ServiceType,
  SwarmStartPayload,
  SwarmUpdatePayload,
  SwarmCompletedPayload,
  RankedShortlistEntry,
  PreferenceWeights,
} from "@/backend/types";

export type { ProviderAgent, RankedShortlistEntry, PreferenceWeights, ServiceType } from "@/backend/types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface SwarmControllerResult {
  agents: ProviderAgent[];
  winner: ProviderAgent | null;
  /** Ranked shortlist from backend (earliest availability, rating, distance, user weights) */
  rankedShortlist: RankedShortlistEntry[];
  /** Current service type (from swarm:start); defaults to "dentist" if missing */
  serviceType: ServiceType;
  isRunning: boolean;
  logs: string[];
  startSwarm: (serviceType?: string, options?: { maxProviders?: number; preferenceWeights?: PreferenceWeights }) => void;
  reset: () => void;
}

const DEFAULT_SERVICE_TYPE: ServiceType = "dentist";

export function useSwarmController(): SwarmControllerResult {
  const [agents, setAgents] = useState<ProviderAgent[]>([]);
  const [winner, setWinner] = useState<ProviderAgent | null>(null);
  const [rankedShortlist, setRankedShortlist] = useState<RankedShortlistEntry[]>([]);
  const [serviceType, setServiceType] = useState<ServiceType>(DEFAULT_SERVICE_TYPE);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const orchestratorRef = useRef<SwarmOrchestrator | null>(null);
  const useApiRef = useRef<boolean | null>(null); // null = not yet tried

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const reset = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    orchestratorRef.current?.cleanup();
    orchestratorRef.current = null;
    useApiRef.current = null;
    setAgents([]);
    setWinner(null);
    setRankedShortlist([]);
    setServiceType(DEFAULT_SERVICE_TYPE);
    setIsRunning(false);
    setLogs([]);
  }, []);

  const startSwarm = useCallback(async (serviceType = "dentist", options?: { maxProviders?: number; preferenceWeights?: PreferenceWeights }) => {
    reset();
    setIsRunning(true);
    setLogs([]);
    setAgents([]);

    const tryApi = useApiRef.current !== false;
    const maxProviders = Math.min(Math.max(1, options?.maxProviders ?? 5), 15);

    if (tryApi) {
      try {
        const res = await fetch(`${API_BASE}/api/appointments/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_type: serviceType,
            max_providers: maxProviders,
            preference_weights: options?.preferenceWeights ?? undefined,
          }),
        });
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        const swarmId = data.swarm_id;
        const wsUrl =
          data.websocket_url ||
          (typeof window !== "undefined"
            ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${new URL(API_BASE).host}/api/appointments/ws/${swarmId}`
            : `ws://localhost:8000/api/appointments/ws/${swarmId}`);

        useApiRef.current = true;
        addLog(`🚀 Swarm initiated — dispatching ${maxProviders} AI agents...`);
        addLog(`📡 Swarm ID: ${swarmId}`);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (ev) => {
          try {
            const { event, data } = JSON.parse(ev.data);
            if (event === "swarm:start") {
              setAgents((data.agents || []).map(normalizeAgent));
              if (data.service_type) setServiceType(data.service_type);
            } else if (event === "swarm:update") {
              setAgents((prev) =>
                prev.map((a) =>
                  a.id === data.agentId
                    ? { ...a, status: data.status, slotTime: data.slotTime ?? a.slotTime }
                    : a
                )
              );
              if (data.message) addLog(data.message);
            } else if (event === "agent:booked") {
              if (data.providerName && data.slotTime) {
                addLog(`🤖 ElevenLabs agent confirmed booking at ${data.slotTime}`);
              }
            } else if (event === "swarm:completed") {
              const all = (data.allAgents || []).map(normalizeAgent);
              setAgents(all);
              setRankedShortlist(Array.isArray(data.rankedShortlist) ? data.rankedShortlist : []);
              setIsRunning(false);
              if (data.winnerId && data.winnerName && data.winnerSlot) {
                const w = all.find((a: ProviderAgent) => a.id === data.winnerId) ?? null;
                setWinner(w);
                addLog(`🏆 Winner: ${data.winnerName} at ${data.winnerSlot}`);
              } else {
                addLog("⚠️ No valid slots found. Try again.");
              }
            }
          } catch {
            /* ignore parse errors */
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
        };

        ws.onerror = () => {
          ws.close();
        };

        return;
      } catch (_) {
        useApiRef.current = false;
        addLog("📴 API unreachable — using in-browser simulation");
      }
    }

    // Fallback: in-browser SwarmOrchestrator
    const orchestrator = new SwarmOrchestrator();
    orchestratorRef.current = orchestrator;

    const unsubStart = eventBus.on("swarm:start", (payload: unknown) => {
      const d = payload as SwarmStartPayload;
      setAgents(d.agents);
      setServiceType((d.service_type as ServiceType) ?? DEFAULT_SERVICE_TYPE);
      addLog(`🚀 Swarm initiated — dispatching ${d.agents.length} AI agents...`);
      addLog(`📡 Swarm ID: ${d.swarmId}`);
    });
    const unsubUpdate = eventBus.on("swarm:update", (payload: unknown) => {
      const d = payload as SwarmUpdatePayload;
      setAgents((prev) =>
        prev.map((a) =>
          a.id === d.agentId ? { ...a, status: d.status, slotTime: d.slotTime ?? a.slotTime } : a
        )
      );
      if (d.message) addLog(d.message);
    });
    const unsubCompleted = eventBus.on("swarm:completed", (payload: unknown) => {
      const d = payload as SwarmCompletedPayload;
      setAgents(d.allAgents);
      setRankedShortlist(d.rankedShortlist ?? []);
      setIsRunning(false);
      if (d.winnerId && d.winnerName && d.winnerSlot) {
        const w = d.allAgents.find((a) => a.id === d.winnerId) ?? null;
        setWinner(w);
        addLog(`🏆 Winner: ${d.winnerName} at ${d.winnerSlot}`);
      } else {
        addLog("⚠️ No valid slots found. Try again.");
      }
    });

    orchestrator.start(serviceType as ServiceType);

    return () => {
      unsubStart();
      unsubUpdate();
      unsubCompleted();
    };
  }, [addLog, reset]);

  useEffect(() => () => reset(), [reset]);

  return { agents, winner, rankedShortlist, serviceType, isRunning, logs, startSwarm, reset };
}

function normalizeAgent(a: Record<string, unknown>): ProviderAgent {
  return {
    id: String(a.id ?? ""),
    name: String(a.name ?? ""),
    status: String(a.status ?? "idle") as ProviderAgent["status"],
    slotTime: a.slotTime != null ? String(a.slotTime) : null,
    elevenlabsReady: Boolean(a.elevenlabsReady),
  };
}
