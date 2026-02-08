"""
CallPilot - Preference Engine
Combines Google Places rating, travel distance, availability timing, and custom user weighting.
Used for ranking and slot validation.
"""
from typing import Optional
from .models import ProviderAgent, AgentStatus
from .scoring import parse_time, calculate_score
from .calendar_service import is_slot_available, check_double_booking


# Default weights: time 50%, rating 30%, distance 20%
DEFAULT_WEIGHTS = {
    "earliest_availability": 0.5,
    "rating": 0.3,
    "distance": 0.2,
}


def get_provider_rating(provider_id: str, provider_name: str, metadata: Optional[dict] = None) -> float:
    """Resolve rating (0-5). Prefer metadata from provider list."""
    if metadata and "rating" in metadata:
        return float(metadata.get("rating", 4.5))
    # Fallback from a small map if we had one per id
    return 4.5


def get_provider_distance_miles(provider_id: str, provider_name: str, metadata: Optional[dict] = None) -> float:
    """Resolve distance in miles. Prefer metadata from provider list."""
    if metadata and "distanceMiles" in metadata:
        return float(metadata.get("distanceMiles", 5.0))
    return 5.0


def compute_preference_score(
    provider: ProviderAgent,
    user_weights: Optional[dict] = None,
    provider_metadata: Optional[dict] = None,
) -> float:
    """
    Multi-factor score using:
    - Earliest availability (earlier = better)
    - Google Places-style rating (0-5)
    - Distance / travel time (closer = better)
    Custom user weighting overrides defaults.
    """
    weights = {**DEFAULT_WEIGHTS}
    if user_weights:
        weights.update({k: v for k, v in user_weights.items() if k in weights})

    meta = provider_metadata or {}
    rating = get_provider_rating(provider.id, provider.name, meta)
    distance_miles = get_provider_distance_miles(provider.id, provider.name, meta)

    return calculate_score(
        provider,
        time_weight=weights.get("earliest_availability", DEFAULT_WEIGHTS["earliest_availability"]),
        rating_weight=weights.get("rating", DEFAULT_WEIGHTS["rating"]),
        distance_weight=weights.get("distance", DEFAULT_WEIGHTS["distance"]),
        rating_value=rating,
        distance_miles=distance_miles,
    )


def validate_slot_against_calendar(
    proposed_time: str,
    user_id: Optional[str] = None,
) -> dict:
    """
    Prevents double booking: cross-reference proposed slot with user schedule.
    Returns { "valid": bool, "available": bool, "conflict_with": str | None, "message": str }.
    """
    check = check_double_booking(proposed_time, user_id)
    if check["available"]:
        return {
            "valid": True,
            "available": True,
            "conflict_with": None,
            "message": f"Slot {proposed_time} is free on your calendar.",
        }
    return {
        "valid": False,
        "available": False,
        "conflict_with": check.get("conflict_with"),
        "message": f"Slot {proposed_time} conflicts with an existing event.",
    }


def rank_with_preferences(
    agents: list,
    user_weights: Optional[dict] = None,
    provider_metadata_map: Optional[dict] = None,
    min_valid_time_minutes: int = 570,  # 9:30 AM
) -> list:
    """
    Rank agents by preference engine (earliest availability, rating, distance, user weights).
    Returns list of (agent, score) sorted best-first, only including agents with valid slots.
    """
    provider_metadata_map = provider_metadata_map or {}
    results = []
    for a in agents:
        if a.status != AgentStatus.BOOKED or not a.slotTime:
            continue
        mins = parse_time(a.slotTime)
        if mins < min_valid_time_minutes:
            continue
        meta = provider_metadata_map.get(a.id, {})
        if hasattr(a, "rating"):
            meta = {**meta, "rating": getattr(a, "rating", 4.5)}
        if hasattr(a, "distance_miles"):
            meta = {**meta, "distanceMiles": getattr(a, "distance_miles", 5.0)}
        score = compute_preference_score(a, user_weights, meta)
        results.append((a, score))
    results.sort(key=lambda x: -x[1])
    return results
