/**
 * Provider metadata for ranking display (availability, rating, distance).
 * Default for dentists; other services use getProviderMetadataByService(serviceType).
 */
export const PROVIDER_METADATA: Record<
  string,
  { name: string; rating: number; distanceMiles: number }
> = {
  "agent-1": { name: "Dr. Sarah Chen", rating: 4.8, distanceMiles: 1.2 },
  "agent-2": { name: "Smile Dental Clinic", rating: 4.5, distanceMiles: 2.8 },
  "agent-3": { name: "Bright Smiles Co.", rating: 4.9, distanceMiles: 4.1 },
  "agent-4": { name: "Metro Dental Group", rating: 4.3, distanceMiles: 0.8 },
  "agent-5": { name: "Downtown Dental Care", rating: 4.6, distanceMiles: 3.5 },
};

function parseTime(t: string | null): number {
  if (!t) return Infinity;
  const [time, period] = t.trim().toUpperCase().split(/\s+/);
  if (!time || !period) return Infinity;
  const [h, m] = time.split(":").map(Number);
  let hours = h ?? 0;
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + (m ?? 0);
}

export type ProviderMetadataMap = Record<string, { name: string; rating: number; distanceMiles: number }>;

/**
 * Service-agnostic ranking: earliest availability, rating, distance.
 * Uses metadataOverride when provided (multi-service); otherwise PROVIDER_METADATA (dentist backward compat).
 */
export function rankProviders(
  agents: { id: string; name: string; slotTime: string | null; status: string }[],
  metadataOverride?: ProviderMetadataMap
): Array<{
  id: string;
  name: string;
  slotTime: string | null;
  status: string;
  rank: number;
  score: number;
  rating: number;
  distanceMiles: number;
}> {
  const meta = metadataOverride ?? PROVIDER_METADATA;
  const minValid = parseTime("9:30 AM");
  const withSlots = agents
    .filter((a) => a.slotTime && parseTime(a.slotTime) >= minValid)
    .map((a) => {
      const m = meta[a.id] ?? { name: a.name, rating: 4.5, distanceMiles: 2 };
      const timeScore = 1 - (parseTime(a.slotTime!) - minValid) / 540;
      const ratingScore = m.rating / 5;
      const distanceScore = Math.max(0, 1 - m.distanceMiles / 5);
      const score = timeScore * 0.5 + ratingScore * 0.3 + distanceScore * 0.2;
      return {
        ...a,
        rank: 0,
        score,
        rating: m.rating,
        distanceMiles: m.distanceMiles,
      };
    })
    .sort((a, b) => b.score - a.score);

  return withSlots.map((p, i) => ({ ...p, rank: i + 1 }));
}
