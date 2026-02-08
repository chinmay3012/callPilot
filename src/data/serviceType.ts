/**
 * Canonical ServiceType and normalizer for CTA buttons and text input.
 * Ensures both produce the same normalized service_type end-to-end.
 */

import type { ServiceType } from "@/backend/types";

const SERVICE_ALIASES: Record<string, ServiceType> = {
  dentist: "dentist",
  dental: "dentist",
  doctor: "doctor",
  physician: "doctor",
  medical: "doctor",
  vet: "vet",
  veterinarian: "vet",
  plumber: "plumber",
  plumbing: "plumber",
  salon: "salon",
  haircut: "salon",
  hair: "salon",
  barber: "salon",
  auto_repair: "auto_repair",
  auto: "auto_repair",
  car: "auto_repair",
  mechanic: "auto_repair",
  therapist: "therapist",
  counseling: "therapist",
  mental: "therapist",
};

const DEFAULT_SERVICE: ServiceType = "dentist";

/**
 * Normalize free-form input (button id or query keyword) to canonical ServiceType.
 * Used by both CTA buttons and inferServiceTypeFromQuery.
 */
export function normalizeServiceType(input: string | undefined): ServiceType {
  if (!input || typeof input !== "string") return DEFAULT_SERVICE;
  const key = input.trim().toLowerCase();
  return SERVICE_ALIASES[key] ?? DEFAULT_SERVICE;
}

/** Human-readable label for UI (e.g. "Dentist", "Auto Repair") */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  dentist: "Dentist",
  doctor: "Doctor",
  vet: "Vet",
  plumber: "Plumber",
  salon: "Salon",
  auto_repair: "Auto Service",
  therapist: "Therapist",
};

export function getServiceTypeLabel(serviceType: ServiceType): string {
  return SERVICE_TYPE_LABELS[serviceType] ?? "Provider";
}
