"""
CallPilot - Calendar Service
Real-time calendar checks to prevent double booking.
Cross-references proposed slots with user schedule.
"""
from datetime import datetime, date, timedelta
from typing import List, Optional
import re


# Mock user busy slots (in production: Google Calendar / Outlook API)
# Format: list of (start_time_str, end_time_str) for "today"
def _mock_busy_slots(user_id: Optional[str] = None, for_date: Optional[str] = None) -> List[tuple[str, str]]:
    """Return busy slots for the user. Default: today, mock data."""
    # Mock: user has 9:00–9:30 AM and 2:00–3:00 PM taken
    return [
        ("9:00 AM", "9:30 AM"),
        ("2:00 PM", "3:00 PM"),
    ]


def parse_time_to_minutes(t: str) -> int:
    """Parse '10:30 AM' to minutes since midnight."""
    if not t or not isinstance(t, str):
        return 0
    t = t.strip().upper().replace(".", "")
    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(AM|PM)", t)
    if not match:
        return 0
    h = int(match.group(1))
    m = int(match.group(2) or 0)
    period = match.group(3)
    if period == "PM" and h != 12:
        h += 12
    if period == "AM" and h == 12:
        h = 0
    return h * 60 + m


def minutes_to_str(m: int) -> str:
    """Convert minutes since midnight to 'H:MM AM/PM'."""
    h, m = divmod(m, 60)
    if h == 0:
        return f"12:{m:02d} AM"
    if h < 12:
        return f"{h}:{m:02d} AM"
    if h == 12:
        return f"12:{m:02d} PM"
    return f"{h - 12}:{m:02d} PM"


def get_busy_slots(user_id: Optional[str] = None, for_date: Optional[str] = None) -> List[dict]:
    """
    Return user's busy slots for the given date.
    for_date: 'today' | 'tomorrow' | YYYY-MM-DD (optional).
    """
    slots = _mock_busy_slots(user_id, for_date)
    return [
        {"start": s[0], "end": e}
        for s, e in slots
    ]


def is_slot_available(proposed_time: str, user_id: Optional[str] = None, for_date: Optional[str] = None) -> bool:
    """
    Check if the proposed slot conflicts with user's calendar.
    proposed_time: e.g. "10:30 AM". Assumes 30-min appointment.
    """
    busy = _mock_busy_slots(user_id, for_date)
    start_m = parse_time_to_minutes(proposed_time)
    end_m = start_m + 30  # 30 min appointment

    for start_str, end_str in busy:
        b_start = parse_time_to_minutes(start_str)
        b_end = parse_time_to_minutes(end_str)
        # Overlap if [start_m, end_m) overlaps [b_start, b_end)
        if start_m < b_end and end_m > b_start:
            return False
    return True


def get_available_windows(user_id: Optional[str] = None, for_date: Optional[str] = None) -> List[dict]:
    """
    Return free time windows for the day (simplified: business hours 8 AM - 5 PM,
    excluding busy slots).
    """
    busy = _mock_busy_slots(user_id, for_date)
    day_start = 8 * 60  # 8 AM
    day_end = 17 * 60   # 5 PM
    busy_ranges = [(parse_time_to_minutes(s), parse_time_to_minutes(e)) for s, e in busy]
    busy_ranges.sort()

    free = []
    current = day_start
    for b_start, b_end in busy_ranges:
        if current < b_start and b_start - current >= 30:  # at least 30 min free
            free.append({
                "start": minutes_to_str(current),
                "end": minutes_to_str(b_start),
            })
        current = max(current, b_end)
    if day_end - current >= 30:
        free.append({
            "start": minutes_to_str(current),
            "end": minutes_to_str(day_end),
        })
    return free


def check_double_booking(proposed_time: str, user_id: Optional[str] = None) -> dict:
    """
    Real-time calendar check. Returns:
    - available: bool
    - conflict_with: optional description of conflicting event
    """
    if is_slot_available(proposed_time, user_id, "today"):
        return {"available": True, "conflict_with": None}
    busy = _mock_busy_slots(user_id, None)
    start_m = parse_time_to_minutes(proposed_time)
    for start_str, end_str in busy:
        b_start = parse_time_to_minutes(start_str)
        b_end = parse_time_to_minutes(end_str)
        if start_m < b_end and start_m + 30 > b_start:
            return {
                "available": False,
                "conflict_with": f"Existing event {start_str}–{end_str}",
            }
    return {"available": True, "conflict_with": None}
