"""
CallPilot - Agent Tool Execution
Runs agentic tools (query_calendar, lookup_provider, calculate_distance, validate_slot)
and returns JSON-serializable results for the ElevenLabs agent.
"""
from typing import Any, Dict, Optional

from .calendar_service import get_available_windows, check_double_booking, parse_time_to_minutes
from .provider_service import load_providers

MIN_VALID_TIME = "9:30 AM"


def run_tool(tool_name: str, arguments: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Execute a single tool and return a result the voice agent can use.
    context may include: user_id, agent_id, swarm_id.
    """
    args = arguments or {}
    if tool_name == "query_calendar":
        return _query_calendar(args.get("for_date", "today"), context)
    if tool_name == "lookup_provider":
        return _lookup_provider(args.get("provider_name"), args.get("provider_id"), context)
    if tool_name == "calculate_distance":
        return _calculate_distance(args.get("provider_name"), args.get("provider_address"), context)
    if tool_name == "validate_slot":
        return _validate_slot(args.get("slot_time"), args.get("provider_name"), context)
    return {"error": f"Unknown tool: {tool_name}"}


def _query_calendar(for_date: str, context: Optional[Dict] = None) -> Dict[str, Any]:
    """Return patient's free time windows to avoid double booking."""
    user_id = (context or {}).get("user_id")
    windows = get_available_windows(user_id=user_id, for_date=for_date or "today")
    return {
        "for_date": for_date or "today",
        "free_windows": windows,
        "message": f"Patient has {len(windows)} free window(s) on {for_date or 'today'}. Prefer requesting slots within these times.",
    }


def _lookup_provider(provider_name: Optional[str], provider_id: Optional[str], context: Optional[Dict] = None) -> Dict[str, Any]:
    """Return provider details: name, rating, distance (Google Places style)."""
    providers = load_providers(max_count=20)
    name = (provider_name or "").strip()
    for p in providers:
        if provider_id and p.get("id") == provider_id:
            return {
                "provider_id": p["id"],
                "name": p.get("name", p["id"]),
                "rating": p.get("rating", 4.5),
                "distance_miles": p.get("distanceMiles", 5.0),
                "message": f"Provider {p.get('name')}: rating {p.get('rating', 4.5)}/5, {p.get('distanceMiles', 5)} mi away.",
            }
        if name and name.lower() in (p.get("name") or "").lower():
            return {
                "provider_id": p.get("id"),
                "name": p.get("name"),
                "rating": p.get("rating", 4.5),
                "distance_miles": p.get("distanceMiles", 5.0),
                "message": f"Provider {p.get('name')}: rating {p.get('rating', 4.5)}/5, {p.get('distanceMiles', 5)} mi away.",
            }
    return {
        "provider_name": provider_name,
        "message": f"No details found for provider '{provider_name}'. You can still proceed with scheduling.",
    }


def _calculate_distance(provider_name: Optional[str], provider_address: Optional[str], context: Optional[Dict] = None) -> Dict[str, Any]:
    """Return distance and estimated travel time (mock or Google Maps API)."""
    providers = load_providers(max_count=20)
    name = (provider_name or "").strip()
    for p in providers:
        if name and name.lower() in (p.get("name") or "").lower():
            miles = p.get("distanceMiles", 5.0)
            # Rough: 2 min per mile in city
            travel_mins = int(miles * 2.5)
            return {
                "provider_name": p.get("name"),
                "distance_miles": miles,
                "travel_time_minutes": travel_mins,
                "message": f"About {miles} miles, ~{travel_mins} min travel. Prefer closer if slots are similar.",
            }
    return {
        "provider_name": provider_name,
        "distance_miles": 5.0,
        "travel_time_minutes": 12,
        "message": "Distance unknown; assuming ~5 mi.",
    }


def _validate_slot(slot_time: Optional[str], provider_name: Optional[str], context: Optional[Dict] = None) -> Dict[str, Any]:
    """Validate slot: no double booking and not before 9:30 AM."""
    if not slot_time:
        return {"valid": False, "message": "No slot time provided."}
    user_id = (context or {}).get("user_id")
    calendar_check = check_double_booking(slot_time.strip(), user_id)
    min_mins = parse_time_to_minutes(MIN_VALID_TIME)
    slot_mins = parse_time_to_minutes(slot_time)
    before_cutoff = slot_mins < min_mins

    if before_cutoff:
        return {
            "valid": False,
            "slot_time": slot_time,
            "available": calendar_check.get("available", True),
            "message": f"Slot {slot_time} is before the minimum allowed time (9:30 AM). Ask the receptionist for a later slot.",
        }
    if not calendar_check.get("available"):
        return {
            "valid": False,
            "slot_time": slot_time,
            "conflict_with": calendar_check.get("conflict_with"),
            "message": f"Slot {slot_time} conflicts with the patient's calendar. Ask for a different time.",
        }
    return {
        "valid": True,
        "slot_time": slot_time,
        "available": True,
        "message": f"Slot {slot_time} is valid and free. You may confirm this slot with the receptionist and then call book_appointment.",
    }
