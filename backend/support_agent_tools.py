"""
CallPilot - Support Agent Tool Execution

Runs tools for the Support agent (Find Doctor, Find Dentist, etc.):
find_provider, query_calendar, get_provider_details, check_availability,
validate_slot, schedule_appointment.
"""
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import DATA_DIR, DEMO_MODE
from .calendar_service import get_available_windows, check_double_booking, parse_time_to_minutes
from .provider_service import load_providers
from .bookings_store import (
    list_appointments,
    reschedule_appointment_by_provider,
    cancel_appointment_by_provider,
    register_waitlist_entry,
    add_appointment,
)

MIN_VALID_TIME = "9:30 AM"

# Canonical service types we support (keys in support_services + "dentist" from mock_providers)
_CANONICAL_SERVICE_TYPES = frozenset({
    "doctor", "dentist", "vet", "plumber", "salon", "auto_repair", "therapist",
    "fitness", "home_cleaning",
})

# Map natural-language phrases to canonical service_type (order matters: longer matches first)
_SERVICE_TYPE_HINTS = [
    ("dentist", "dentist"),
    ("dental", "dentist"),
    ("doctor", "doctor"),
    ("physician", "doctor"),
    ("vet", "vet"),
    ("veterinar", "vet"),
    ("plumber", "plumber"),
    ("plumbing", "plumber"),
    ("salon", "salon"),
    ("haircut", "salon"),
    ("hair cut", "salon"),
    ("barber", "salon"),
    ("auto repair", "auto_repair"),
    ("car repair", "auto_repair"),
    ("mechanic", "auto_repair"),
    ("therapist", "therapist"),
    ("counseling", "therapist"),
    ("counselling", "therapist"),
    ("fitness class", "fitness"),
    ("fitness", "fitness"),
    ("personal trainer", "fitness"),
    ("gym", "fitness"),
    ("yoga class", "fitness"),
    ("pilates", "fitness"),
    ("home cleaning", "home_cleaning"),
    ("house cleaning", "home_cleaning"),
    ("cleaning service", "home_cleaning"),
    ("maid", "home_cleaning"),
    ("cleaner", "home_cleaning"),
]


def _all_known_provider_names() -> List[str]:
    """All provider names from mock_providers and support_services for intent matching."""
    names: List[str] = []
    for p in load_providers(service_type="dentist", max_count=20):
        n = (p.get("name") or "").strip()
        if n:
            names.append(n)
    services = _load_support_services()
    for _st, providers in services.items():
        for p in providers:
            n = (p.get("name") or "").strip()
            if n and n not in names:
                names.append(n)
    return names


def _name_parts(name: str) -> List[str]:
    """Significant words in a provider name (skip titles like Dr, Mr)."""
    skip = {"dr", "dr.", "mr", "mr.", "ms", "ms.", "mrs", "mrs."}
    return [p for p in name.replace(".", " ").split() if p.lower() not in skip and len(p) > 1]


def infer_tool_from_input(input_str: str) -> Optional[Dict[str, Any]]:
    """
    When the agent sends only free-text input, infer tool and arguments.
    - Calendar/appointments: "check my calendar", "my appointments", "what do I have booked" → list_my_appointments.
    - Provider availability: "check availability for Dr. Sarah Chen", "try sarah chen" → check_availability(provider_name).
    Returns {"tool_name": "...", "arguments": {...}} or None.
    """
    if not input_str or not isinstance(input_str, str):
        return None
    s = input_str.strip().lower()
    # User asking to see their calendar or appointments → list_my_appointments
    calendar_keywords = (
        "check my calendar", "check for my calendar", "my calendar", "see my calendar",
        "my appointments", "list my appointments", "show my appointments", "what do i have booked",
        "what's on my calendar", "whats on my calendar", "upcoming appointments", "my bookings",
    )
    if any(k in s for k in calendar_keywords):
        return {"tool_name": "list_my_appointments", "arguments": {}}
    availability_keywords = ("availability", "available", "slots", "when can", "check availability", "get availability")
    if not any(k in s for k in availability_keywords) and "try " not in s and " for " not in s:
        return None
    names = _all_known_provider_names()
    for name in names:
        if name.lower() in s:
            return {"tool_name": "check_availability", "arguments": {"provider_name": name, "for_date": "today"}}
    for name in names:
        parts = _name_parts(name)
        if parts and all(p.lower() in s for p in parts):
            return {"tool_name": "check_availability", "arguments": {"provider_name": name, "for_date": "today"}}
    for name in names:
        short = name.split()[-1] if name.split() else name
        if short.lower() in s and len(short) > 2:
            return {"tool_name": "check_availability", "arguments": {"provider_name": name, "for_date": "today"}}
    return None


def _normalize_service_type(raw: Optional[str]) -> str:
    """Map 'find a dentist', 'dentist', 'find me a doctor' etc. to canonical type (dentist, doctor, vet, ...)."""
    if not raw or not isinstance(raw, str):
        return "doctor"
    s = raw.strip().lower()
    if s in _CANONICAL_SERVICE_TYPES:
        return s
    for phrase, canonical in _SERVICE_TYPE_HINTS:
        if phrase in s:
            return canonical
    return s  # return as-is if no match (e.g. unknown type)


def _load_support_services() -> Dict[str, List[dict]]:
    """Load support_services.json; key = service_type, value = list of providers."""
    path = DATA_DIR / "support_services.json"
    if not path.exists():
        return {}
    with open(path) as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}


def run_support_tool(
    tool_name: str,
    arguments: Dict[str, Any],
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Execute a Support agent tool and return a result for the voice agent.
    context may include: user_id, conversation_id.
    """
    args = arguments or {}
    if tool_name == "find_provider":
        return _find_provider(
            args.get("service_type"),
            args.get("location"),
            args.get("max_distance_miles"),
            args.get("min_rating"),
        )
    if tool_name == "query_calendar":
        return _query_calendar(args.get("for_date", "today"), context)
    if tool_name == "get_provider_details":
        return _get_provider_details(args.get("provider_name"), args.get("provider_id"), context)
    if tool_name == "check_availability":
        return _check_availability(args.get("provider_name"), args.get("for_date"), context)
    if tool_name == "validate_slot":
        return _validate_slot(args.get("slot_time"), args.get("provider_name"), context)
    if tool_name in ("schedule_appointment", "book_appointment"):
        return _schedule_appointment(
            args.get("provider_name"),
            args.get("slot_time"),
            args.get("service_type"),
            args.get("reasoning"),
            context,
        )
    if tool_name == "list_my_appointments":
        return _list_my_appointments(context)
    if tool_name == "reschedule_appointment":
        return _reschedule_appointment(
            args.get("provider_name"),
            args.get("new_slot_time"),
            args.get("reason"),
            context,
        )
    if tool_name == "cancel_appointment":
        return _cancel_appointment(args.get("provider_name"), args.get("reason"), context)
    if tool_name == "request_human_handover":
        return _request_human_handover(args.get("reason"), args.get("confidence"), context)
    if tool_name == "register_waitlist":
        return _register_waitlist(
            args.get("provider_name"),
            args.get("preferred_times"),
            args.get("callback_phone"),
            context,
        )
    return {"error": f"Unknown Support tool: {tool_name}"}


def _find_provider(
    service_type: Optional[str],
    location: Optional[str],
    max_distance_miles: Optional[float],
    min_rating: Optional[float],
) -> Dict[str, Any]:
    """Search providers by type (doctor, dentist, vet, plumber, salon, etc.)."""
    if not service_type:
        return {"error": "Please specify service_type (e.g. doctor, dentist, plumber).", "results": []}
    # Normalize "find a dentist" / "find me a doctor" etc. to canonical type
    st = _normalize_service_type(service_type)
    services = _load_support_services()

    # Dentists: use existing mock_providers.json
    if st == "dentist":
        providers = load_providers(service_type="dentist", max_count=10)
    else:
        providers = services.get(st, [])

    if not providers:
        return {
            "service_type": st,
            "message": f"No providers found for '{service_type}'. Try a different type or broader area.",
            "results": [],
        }

    # Apply optional filters (normalize both distanceMiles and distance_miles)
    max_d = max_distance_miles if max_distance_miles is not None else 999
    min_r = min_rating if min_rating is not None else 0
    out = []
    for p in providers:
        dist = p.get("distanceMiles") or p.get("distance_miles") or 5.0
        rating = p.get("rating") or 4.5
        if dist <= max_d and rating >= min_r:
            out.append({
                "id": p.get("id"),
                "name": p.get("name", p.get("id")),
                "rating": rating,
                "distance_miles": dist,
                "specialty": p.get("specialty"),
            })

    out.sort(key=lambda x: (-x["rating"], x["distance_miles"]))
    return {
        "service_type": st,
        "location": location or "your area",
        "count": len(out),
        "results": out[:10],
        "message": f"Found {len(out)} {st}(s). Top options: " + ", ".join(r["name"] for r in out[:3]),
    }


def _query_calendar(for_date: Optional[str], context: Optional[Dict] = None) -> Dict[str, Any]:
    """Return user's free time windows."""
    user_id = (context or {}).get("user_id")
    windows = get_available_windows(user_id=user_id, for_date=for_date or "today")
    return {
        "for_date": for_date or "today",
        "free_windows": windows,
        "message": f"You have {len(windows)} free window(s). Prefer suggesting times inside these windows.",
    }


def _get_provider_details(
    provider_name: Optional[str],
    provider_id: Optional[str],
    context: Optional[Dict] = None,
) -> Dict[str, Any]:
    """Get one provider's full details."""
    if not provider_name and not provider_id:
        return {"error": "Provide provider_name or provider_id.", "message": "I need a provider name to look up."}

    # Check mock_providers (dentists)
    dentists = load_providers(max_count=20)
    for p in dentists:
        if provider_id and p.get("id") == provider_id:
            return _provider_detail(p, provider_name or p.get("name"))
        if provider_name and (provider_name or "").strip().lower() in (p.get("name") or "").lower():
            return _provider_detail(p, p.get("name"))

    # Check support_services
    services = _load_support_services()
    for st, providers in services.items():
        for p in providers:
            if provider_id and p.get("id") == provider_id:
                return _provider_detail(p, provider_name or p.get("name"))
            if provider_name and (provider_name or "").strip().lower() in (p.get("name") or "").lower():
                return _provider_detail(p, p.get("name"))

    return {
        "provider_name": provider_name,
        "message": f"No details found for '{provider_name}'. You can still try to schedule if the user has the name.",
    }


def _provider_detail(p: dict, name: str) -> Dict[str, Any]:
    rating = p.get("rating", 4.5)
    dist = p.get("distanceMiles", p.get("distance_miles", 5))
    return {
        "id": p.get("id"),
        "name": name or p.get("name"),
        "rating": rating,
        "distance_miles": dist,
        "specialty": p.get("specialty"),
        "message": f"{name}: {rating}/5 rating, about {dist} miles away.",
    }


def _load_receptionist_simulation() -> Dict[str, Any]:
    """Load receptionist simulation data (slots per provider) for demo."""
    path = DATA_DIR / "receptionist_simulation.json"
    if not path.exists():
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {}


def _get_simulated_slots_for_provider(provider_name: Optional[str], provider_id: Optional[str]) -> List[str]:
    """Get simulated receptionist slots for a provider from receptionist_simulation.json."""
    sim = _load_receptionist_simulation()
    default = sim.get("defaultSlots") or [
        "9:00 AM", "9:30 AM", "10:30 AM", "11:00 AM", "2:00 PM", "3:30 PM", "4:00 PM"
    ]
    by_id = sim.get("byProviderId") or {}
    if provider_id and provider_id in by_id and by_id[provider_id].get("slots"):
        return by_id[provider_id]["slots"]
    if provider_name:
        dentists = load_providers(service_type="dentist", max_count=20)
        for p in dentists:
            if (p.get("name") or "").strip().lower() == (provider_name or "").strip().lower():
                pid = p.get("id")
                if pid and pid in by_id and by_id[pid].get("slots"):
                    return by_id[pid]["slots"]
                break
        services = _load_support_services()
        for _st, providers in services.items():
            for p in providers:
                if (p.get("name") or "").strip().lower() == (provider_name or "").strip().lower():
                    pid = p.get("id")
                    if pid and pid in by_id and by_id[pid].get("slots"):
                        return by_id[pid]["slots"]
                    return default
    return default


def _check_availability(
    provider_name: Optional[str],
    for_date: Optional[str],
    context: Optional[Dict] = None,
) -> Dict[str, Any]:
    """Return mock available slots or next-available for a provider (receptionist simulation)."""
    if not provider_name:
        return {"error": "Provide provider_name.", "slots": [], "message": "I need a provider name to check availability."}
    slots = _get_simulated_slots_for_provider(provider_name.strip(), None)
    return {
        "provider_name": provider_name,
        "for_date": for_date or "today",
        "slots": slots,
        "next_available": slots[0] if slots else None,
        "message": f"Available times for {provider_name}: {', '.join(slots[:5])}{'...' if len(slots) > 5 else ''}.",
    }


def _validate_slot(slot_time: Optional[str], provider_name: Optional[str], context: Optional[Dict] = None) -> Dict[str, Any]:
    """Validate slot: no double booking, and not before minimum time. In DEMO_MODE, calendar is treated as free."""
    if not slot_time:
        return {"valid": False, "message": "No time provided."}
    user_id = (context or {}).get("user_id")
    calendar_ok = (
        {"available": True}
        if DEMO_MODE
        else check_double_booking(slot_time.strip(), user_id)
    )
    min_mins = parse_time_to_minutes(MIN_VALID_TIME)
    slot_mins = parse_time_to_minutes(slot_time)
    before_cutoff = slot_mins < min_mins

    if before_cutoff:
        return {
            "valid": False,
            "slot_time": slot_time,
            "message": f"{slot_time} is before 9:30 AM. Suggest a later time.",
        }
    if not calendar_ok.get("available"):
        return {
            "valid": False,
            "slot_time": slot_time,
            "conflict_with": calendar_ok.get("conflict_with"),
            "message": f"{slot_time} conflicts with the user's calendar. Suggest a different time.",
        }
    return {
        "valid": True,
        "slot_time": slot_time,
        "message": f"{slot_time} is free. You can confirm this with the user and call schedule_appointment.",
    }


def _schedule_appointment(
    provider_name: Optional[str],
    slot_time: Optional[str],
    service_type: Optional[str],
    reasoning: Optional[str],
    context: Optional[Dict] = None,
) -> Dict[str, Any]:
    """Confirm and schedule; optionally run calendar check again."""
    if not provider_name:
        return {"success": False, "message": "Missing provider name. Please specify which provider to book."}
    if not slot_time or not str(slot_time).strip():
        return {
            "success": False,
            "message": "You must include slot_time in every schedule_appointment call. If the user already gave a time (e.g. '3:30 PM', 'Tomorrow at 3:30 PM'), call schedule_appointment again now with the same provider_name, service_type, reasoning, and set slot_time to that exact time. Do not ask the user again—use the time they already said. If they have not given a time yet, ask once: 'What date and time work for you?' then call schedule_appointment with that time included.",
        }
    user_id = (context or {}).get("user_id")
    # In DEMO_MODE, treat calendar as always free so Support Agent bookings succeed (same as Find Dentist flow)
    calendar_ok = (
        {"available": True}
        if DEMO_MODE
        else check_double_booking(slot_time.strip(), user_id)
    )
    if not calendar_ok.get("available"):
        return {
            "success": False,
            "message": f"Could not book: {slot_time} conflicts with the calendar. Ask the user for another time.",
        }
    st = (service_type or "appointment").strip().lower()
    # Persist to bookings store so list/reschedule/cancel can see it
    user_id = (context or {}).get("user_id")
    add_appointment(
        provider_name=provider_name,
        slot_time=slot_time,
        service_type=st,
        user_id=user_id,
    )
    return {
        "success": True,
        "provider_name": provider_name,
        "slot_time": slot_time,
        "service_type": st,
        "confirmation_message": f"Your {st} appointment with {provider_name} is confirmed for {slot_time}. You're all set!",
        "message": "Appointment scheduled. Tell the user the confirmation message.",
    }


def _list_my_appointments(context: Optional[Dict] = None) -> Dict[str, Any]:
    """List user's appointments from store."""
    user_id = (context or {}).get("user_id")
    appointments = list_appointments(user_id=user_id)
    if not appointments:
        return {
            "appointments": [],
            "message": "You have no upcoming appointments. I can help you book one.",
        }
    summary = [
        f"{a.get('provider_name', '?')} — {a.get('slot_time', '?')} ({a.get('service_type', 'appointment')})"
        for a in appointments
    ]
    return {
        "appointments": appointments,
        "count": len(appointments),
        "message": f"You have {len(appointments)} appointment(s): " + "; ".join(summary),
    }


def _reschedule_appointment(
    provider_name: Optional[str],
    new_slot_time: Optional[str],
    reason: Optional[str],
    context: Optional[Dict] = None,
) -> Dict[str, Any]:
    """Reschedule an existing appointment."""
    if not provider_name:
        return {"success": False, "message": "I need the provider name to reschedule. Use list_my_appointments first."}
    if not new_slot_time or not str(new_slot_time).strip():
        return {"success": False, "message": "Please specify the new date and time (e.g. '2:00 PM Thursday')."}
    user_id = (context or {}).get("user_id")
    calendar_ok = check_double_booking(str(new_slot_time).strip(), user_id)
    if not calendar_ok.get("available"):
        return {
            "success": False,
            "message": f"{new_slot_time} conflicts with your calendar. Please choose another time.",
        }
    updated = reschedule_appointment_by_provider(provider_name.strip(), new_slot_time.strip(), user_id=user_id)
    if not updated:
        return {
            "success": False,
            "message": f"No appointment found with {provider_name}. Say list my appointments to see your bookings.",
        }
    return {
        "success": True,
        "provider_name": provider_name,
        "new_slot_time": new_slot_time,
        "message": f"Your appointment with {provider_name} has been rescheduled to {new_slot_time}. You're all set.",
    }


def _cancel_appointment(
    provider_name: Optional[str],
    reason: Optional[str],
    context: Optional[Dict] = None,
) -> Dict[str, Any]:
    """Cancel an existing appointment."""
    if not provider_name:
        return {"success": False, "message": "I need the provider name to cancel. Use list_my_appointments first."}
    user_id = (context or {}).get("user_id")
    removed = cancel_appointment_by_provider(provider_name.strip(), user_id=user_id)
    if not removed:
        return {
            "success": False,
            "message": f"No appointment found with {provider_name}. Say list my appointments to see your bookings.",
        }
    return {
        "success": True,
        "provider_name": provider_name,
        "message": f"Your appointment with {provider_name} has been cancelled. Is there anything else I can help with?",
    }


def _request_human_handover(
    reason: Optional[str],
    confidence: Optional[str],
    context: Optional[Dict] = None,
) -> Dict[str, Any]:
    """Signal handover to human; backend can emit event for UI/live transfer."""
    return {
        "handover": True,
        "reason": reason or "Agent requested human assistance",
        "confidence": (confidence or "medium").lower(),
        "message": "I'm connecting you with a team member who can help. Please hold.",
    }


def _register_waitlist(
    provider_name: Optional[str],
    preferred_times: Optional[str],
    callback_phone: Optional[str],
    context: Optional[Dict] = None,
) -> Dict[str, Any]:
    """Add user to provider waitlist for callback when slots open."""
    if not provider_name or not str(provider_name).strip():
        return {"success": False, "message": "I need the provider name to add you to their waitlist."}
    user_id = (context or {}).get("user_id")
    register_waitlist_entry(
        provider_name=provider_name.strip(),
        user_id=user_id,
        preferred_times=preferred_times,
        callback_phone=callback_phone,
    )
    return {
        "success": True,
        "provider_name": provider_name,
        "message": f"You're on the waitlist for {provider_name}. We'll notify you when a slot opens. You can also ask for a callback number to be contacted.",
    }
