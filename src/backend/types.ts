/**
 * Shared types between backend simulation and frontend.
 * 
 * In production, these would live in a shared package or
 * be generated from the backend's OpenAPI / GraphQL schema.
 */

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
  /** Whether this provider is wired for ElevenLabs voice agent */
  elevenlabsReady: boolean;
}

export interface SwarmStartPayload {
  swarmId: string;
  agents: ProviderAgent[];
  timestamp: number;
}

export interface SwarmUpdatePayload {
  swarmId: string;
  agentId: string;
  status: AgentStatus;
  slotTime: string | null;
  message: string;
}

export interface SwarmCompletedPayload {
  swarmId: string;
  winnerId: string | null;
  winnerName: string | null;
  winnerSlot: string | null;
  allAgents: ProviderAgent[];
}

export interface AgentBookedPayload {
  swarmId: string;
  agentId: string;
  providerName: string;
  slotTime: string;
}
