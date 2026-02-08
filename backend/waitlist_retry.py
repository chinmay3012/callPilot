"""
CallPilot - Waitlist & Callback Intelligence

Register on provider waitlists; automatic retry logic when slots open.
- Waitlist entries stored in bookings_store.
- This module: check providers for new slots (demo: mock), mark entries for callback, emit events.
In production: integrate with provider API or calendar polling; use Twilio/SIP to place callback.
Run check_waitlist_and_notify periodically (cron or scheduler).
"""
from typing import Any, Callable, Dict, List, Optional

from .bookings_store import get_waitlist_entries, mark_waitlist_entry_notified


def _mock_slots_available(provider_name: str) -> bool:
    """
    Demo: assume slots sometimes "open". In production, call provider API or calendar.
    """
    return len(provider_name or "") % 2 == 0


def check_waitlist_and_notify(
    broadcast_support: Optional[Callable[[str, str, dict], None]] = None,
) -> List[Dict[str, Any]]:
    """
    For each pending waitlist entry, check if the provider has slots (mock or real).
    If yes, mark as notified and optionally emit support:waitlist_callback.
    Returns list of {entry_id, provider_name, callback_phone, user_id}.
    """
    entries = [e for e in get_waitlist_entries() if e.get("status") == "pending"]
    notified: List[Dict[str, Any]] = []
    for entry in entries:
        provider_name = entry.get("provider_name") or ""
        if not provider_name or not _mock_slots_available(provider_name):
            continue
        entry_id = entry.get("id")
        if not entry_id:
            continue
        mark_waitlist_entry_notified(entry_id)
        notified.append({
            "entry_id": entry_id,
            "provider_name": provider_name,
            "callback_phone": entry.get("callback_phone"),
            "user_id": entry.get("user_id"),
        })
        if broadcast_support and entry.get("user_id"):
            broadcast_support(str(entry["user_id"]), "support:waitlist_callback", {
                "provider_name": provider_name,
                "message": f"A slot may be available at {provider_name}. We've noted your callback request.",
            })
    return notified
