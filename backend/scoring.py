"""
CallPilot - Intelligent Ranking / Scoring Engine
Multi-factor scoring: time + rating + distance
"""
from typing import Optional
from .models import ProviderAgent, AgentStatus


def parse_time(t: str) -> int:
    """Parse '10:30 AM' to minutes since midnight"""
    if not t:
        return 0
    t = str(t).strip().upper()
    parts = t.replace(".", "").split()
    if len(parts) < 2:
        return 0
    time_part, period = parts[0], parts[1] if len(parts) > 1 else "AM"
    h, m = 0, 0
    if ":" in time_part:
        h, m = map(int, time_part.split(":")[:2])
    else:
        h = int(time_part)
    if period == "PM" and h != 12:
        h += 12
    if period == "AM" and h == 12:
        h = 0
    return h * 60 + m


def calculate_score(
    provider: ProviderAgent,
    time_weight: float = 0.5,
    rating_weight: float = 0.3,
    distance_weight: float = 0.2,
    rating_value: Optional[float] = None,
    distance_miles: Optional[float] = None,
) -> float:
    """
    Multi-factor score for ranking appointments.
    Higher is better. Returns 0-1.
    Uses earliest availability, Google rating, and distance; supports user weighting.
    """
    score = 0.0

    # Time score: earlier is better (normalize to 0-1)
    if provider.slotTime:
        mins = parse_time(provider.slotTime)
        # 8am=480, 5pm=1020 -> map to 0-1
        if mins >= 480 and mins <= 1020:
            score += time_weight * (1.0 - (mins - 480) / 540)  # Earlier = higher

    # Rating (Google Places style 0-5)
    rating = rating_value if rating_value is not None else getattr(provider, "rating", 4.5)
    score += rating_weight * (rating / 5.0)

    # Distance / travel time (closer = better)
    dist = distance_miles if distance_miles is not None else getattr(provider, "distance_miles", 5.0)
    score += distance_weight * max(0, 1.0 - dist / 10.0)

    return min(1.0, score)


def rank_booked_agents(agents: list[ProviderAgent]) -> Optional[ProviderAgent]:
    """Return the best agent among those with status=booked (earliest slot wins)."""
    booked = [a for a in agents if a.status == AgentStatus.BOOKED and a.slotTime]
    if not booked:
        return None
    return min(booked, key=lambda a: parse_time(a.slotTime or ""))


def rank_booked_agents_scored(
    agents: list[ProviderAgent],
    time_weight: float = 0.5,
    rating_weight: float = 0.3,
    distance_weight: float = 0.2,
    provider_metadata: Optional[dict] = None,
) -> list[tuple[ProviderAgent, float]]:
    """
    Return ranked shortlist of booked agents with scores (best first).
    Uses earliest availability, Google rating, distance, and user weights.
    """
    booked = [a for a in agents if a.status == AgentStatus.BOOKED and a.slotTime]
    if not booked:
        return []
    meta = provider_metadata or {}
    scored = [
        (a, calculate_score(
            a,
            time_weight=time_weight,
            rating_weight=rating_weight,
            distance_weight=distance_weight,
            rating_value=meta.get(a.id, {}).get("rating"),
            distance_miles=meta.get(a.id, {}).get("distanceMiles"),
        ))
        for a in booked
    ]
    scored.sort(key=lambda x: -x[1])
    return scored
