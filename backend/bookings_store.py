"""
CallPilot - Bookings & Waitlist Store

In-memory store for demo; replace with DB in production.
- Existing appointments: list, reschedule, cancel (used by Support Agent tools).
- Waitlist: register for callback when slots open; optional retry logic.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import DATA_DIR

# --- Appointments (user's booked slots) ---
_APPOINTMENTS: List[Dict[str, Any]] = []
_APPOINTMENTS_FILE = DATA_DIR / "bookings_appointments.json"

# --- Waitlist ---
_WAITLIST: List[Dict[str, Any]] = []
_WAITLIST_FILE = DATA_DIR / "bookings_waitlist.json"


def _load_appointments() -> List[Dict[str, Any]]:
    global _APPOINTMENTS
    if _APPOINTMENTS_FILE.exists():
        try:
            with open(_APPOINTMENTS_FILE) as f:
                _APPOINTMENTS = json.load(f)
        except Exception:
            _APPOINTMENTS = []
    return _APPOINTMENTS


def _save_appointments() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(_APPOINTMENTS_FILE, "w") as f:
        json.dump(_APPOINTMENTS, f, indent=2)


def _load_waitlist() -> List[Dict[str, Any]]:
    global _WAITLIST
    if _WAITLIST_FILE.exists():
        try:
            with open(_WAITLIST_FILE) as f:
                _WAITLIST = json.load(f)
        except Exception:
            _WAITLIST = []
    return _WAITLIST


def _save_waitlist() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(_WAITLIST_FILE, "w") as f:
        json.dump(_WAITLIST, f, indent=2)


def list_appointments(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """List appointments (optionally for user_id). Demo: all users share same list."""
    _load_appointments()
    if user_id:
        return [a for a in _APPOINTMENTS if a.get("user_id") == user_id]
    return list(_APPOINTMENTS)


def add_appointment(
    provider_name: str,
    slot_time: str,
    service_type: str,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Add a new appointment (e.g. after schedule_appointment + booking confirmed)."""
    _load_appointments()
    apt = {
        "id": str(uuid.uuid4()),
        "provider_name": provider_name,
        "slot_time": slot_time,
        "service_type": service_type,
        "user_id": user_id,
        "status": "confirmed",
    }
    _APPOINTMENTS.append(apt)
    _save_appointments()
    return apt


def reschedule_appointment_by_provider(
    provider_name: str,
    new_slot_time: str,
    user_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Reschedule first matching appointment for provider to new_slot_time."""
    _load_appointments()
    name_lower = (provider_name or "").strip().lower()
    for a in _APPOINTMENTS:
        if (a.get("provider_name") or "").strip().lower() == name_lower:
            if user_id and a.get("user_id") != user_id:
                continue
            a["slot_time"] = new_slot_time
            a["status"] = "rescheduled"
            _save_appointments()
            return a
    return None


def cancel_appointment_by_provider(
    provider_name: str,
    user_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Cancel first matching appointment for provider; remove from list."""
    _load_appointments()
    name_lower = (provider_name or "").strip().lower()
    for i, a in enumerate(_APPOINTMENTS):
        if (a.get("provider_name") or "").strip().lower() == name_lower:
            if user_id and a.get("user_id") != user_id:
                continue
            removed = _APPOINTMENTS.pop(i)
            _save_appointments()
            return removed
    return None


def register_waitlist_entry(
    provider_name: str,
    user_id: Optional[str] = None,
    preferred_times: Optional[str] = None,
    callback_phone: Optional[str] = None,
) -> Dict[str, Any]:
    """Add user to provider waitlist."""
    _load_waitlist()
    entry = {
        "id": str(uuid.uuid4()),
        "provider_name": provider_name.strip(),
        "user_id": user_id,
        "preferred_times": preferred_times,
        "callback_phone": callback_phone,
        "status": "pending",
    }
    _WAITLIST.append(entry)
    _save_waitlist()
    return entry


def get_waitlist_entries(provider_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """List waitlist entries (optionally for one provider). For retry/callback logic."""
    _load_waitlist()
    if not provider_name:
        return list(_WAITLIST)
    name_lower = provider_name.strip().lower()
    return [e for e in _WAITLIST if (e.get("provider_name") or "").lower() == name_lower and e.get("status") == "pending"]


def mark_waitlist_entry_notified(entry_id: str) -> bool:
    """Mark a waitlist entry as notified (slot opened). Returns True if found and updated."""
    _load_waitlist()
    for e in _WAITLIST:
        if e.get("id") == entry_id:
            e["status"] = "notified"
            _save_waitlist()
            return True
    return False
