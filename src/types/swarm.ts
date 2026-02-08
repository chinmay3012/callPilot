/**
 * Public Swarm Types — UI-facing type definitions.
 *
 * BOUNDARY RULE:
 * All UI components and pages MUST import swarm-related types from this file,
 * never from `src/backend/*`. The backend directory is treated as a server
 * boundary and is off-limits to anything outside the controller layer.
 *
 * These types are intentionally re-exported (not aliased) so that the UI
 * remains decoupled from backend internals. If the backend type shapes
 * change, only this file and the controller need updating.
 */

export type {
  AgentStatus,
  ProviderAgent,
  RankedShortlistEntry,
  PreferenceWeights,
  ServiceType,
} from "@/backend/types";
