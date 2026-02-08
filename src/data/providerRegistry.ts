/**
 * Provider registry by service type.
 * - Dentists → data/mock_providers.json
 * - All other services → data/support_services.json
 * Exports getProvidersByService(service_type) for SwarmOrchestrator and UI.
 */

import type { ServiceType } from "@/backend/types";
import { ELEVENLABS_PROVIDER_CONFIG } from "@/backend/elevenlabs.config";

// Dentist data (has elevenlabsReady per provider)
import dentistData from "../../data/mock_providers.json";
// Other services (elevenlabsReady false for demo)
import supportServicesData from "../../data/support_services.json";

export interface ProviderRecord {
  id: string;
  name: string;
  elevenlabsReady: boolean;
  rating: number;
  distanceMiles: number;
}

type SupportServiceKey = "doctor" | "vet" | "plumber" | "salon" | "auto_repair" | "therapist";

const SUPPORT_KEYS: Record<ServiceType, keyof typeof supportServicesData | "dentist"> = {
  dentist: "dentist",
  doctor: "doctor",
  vet: "vet",
  plumber: "plumber",
  salon: "salon",
  auto_repair: "auto_repair",
  therapist: "therapist",
};

/** Max providers to return per service (demo cap) */
const MAX_PROVIDERS = 5;

function dentistRecords(): ProviderRecord[] {
  const list = Array.isArray(dentistData) ? dentistData : [];
  return list.slice(0, MAX_PROVIDERS).map((p: { id: string; name: string; elevenlabsReady?: boolean; rating?: number; distanceMiles?: number }) => ({
    id: p.id,
    name: p.name,
    elevenlabsReady: Boolean(
      p.elevenlabsReady ?? (ELEVENLABS_PROVIDER_CONFIG as Record<string, { elevenlabsReady: boolean }>)[p.id]?.elevenlabsReady
    ),
    rating: typeof p.rating === "number" ? p.rating : 4.5,
    distanceMiles: typeof p.distanceMiles === "number" ? p.distanceMiles : 2,
  }));
}

function supportRecords(key: SupportServiceKey): ProviderRecord[] {
  const raw = supportServicesData as Record<string, Array<{ id: string; name: string; rating?: number; distanceMiles?: number }>>;
  const list = raw[key] ?? [];
  return list.slice(0, MAX_PROVIDERS).map((p) => ({
    id: p.id,
    name: p.name,
    elevenlabsReady: false,
    rating: typeof p.rating === "number" ? p.rating : 4.5,
    distanceMiles: typeof p.distanceMiles === "number" ? p.distanceMiles : 2,
  }));
}

/**
 * Get providers for the given service type.
 * Used by SwarmOrchestrator to build agents and by ranking for metadata.
 */
export function getProvidersByService(serviceType: ServiceType): ProviderRecord[] {
  if (serviceType === "dentist") return dentistRecords();
  const key = SUPPORT_KEYS[serviceType] as SupportServiceKey;
  if (key && key !== "dentist") return supportRecords(key);
  return dentistRecords();
}

/**
 * Metadata by agent id for the given service (rating, distance).
 * Used for service-agnostic ranking and ProviderCard display.
 */
export function getProviderMetadataByService(
  serviceType: ServiceType
): Record<string, { name: string; rating: number; distanceMiles: number }> {
  const providers = getProvidersByService(serviceType);
  const out: Record<string, { name: string; rating: number; distanceMiles: number }> = {};
  for (const p of providers) {
    out[p.id] = { name: p.name, rating: p.rating, distanceMiles: p.distanceMiles };
  }
  return out;
}
