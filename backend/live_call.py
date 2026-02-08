"""
CallPilot - ElevenLabs Outbound Call Initiation
POST /start-live-call triggers a real outbound call via ElevenLabs Twilio API.
Booking orchestration uses initiate_outbound_call_to_provider(provider_id, slot_time).
"""
import requests
from typing import Optional

from .config import (
    ELEVENLABS_API_KEY,
    ELEVENLABS_AGENT_ID,
    ELEVENLABS_PHONE_NUMBER_ID,
    ELEVENLABS_OUTBOUND_TO_NUMBER,
)


ELEVENLABS_OUTBOUND_URL = "https://api.elevenlabs.io/v1/convai/twilio/outbound-call"

DEFAULT_PROMPT_OVERRIDE = (
    "You are calling to schedule a dental appointment. "
    "Ask for available slots. Accept only slots at 9:30 AM or later. "
    "Use the book_appointment tool when a valid slot is confirmed."
)


def initiate_outbound_call(prompt_override: Optional[str] = None) -> tuple[bool, str]:
    """
    Call ElevenLabs Twilio Outbound API.
    Returns (success, message).
    Uses requests for proper SSL cert handling on macOS.
    """
    if not ELEVENLABS_API_KEY:
        return False, "ELEVENLABS_API_KEY not configured"

    if not ELEVENLABS_AGENT_ID:
        return False, "ELEVENLABS_AGENT_ID not configured"

    if not ELEVENLABS_PHONE_NUMBER_ID:
        return False, "ELEVENLABS_PHONE_NUMBER_ID not configured"

    if not ELEVENLABS_OUTBOUND_TO_NUMBER:
        return False, "ELEVENLABS_OUTBOUND_TO_NUMBER not configured"

    body = {
        "agent_id": ELEVENLABS_AGENT_ID,
        "agent_phone_number_id": ELEVENLABS_PHONE_NUMBER_ID,
        "to_number": ELEVENLABS_OUTBOUND_TO_NUMBER,
    }

    if prompt_override:
        body["conversation_initiation_client_data"] = {"overrides": {"first_message_override": prompt_override}}

    headers = {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
    }

    try:
        resp = requests.post(
            ELEVENLABS_OUTBOUND_URL,
            json=body,
            headers=headers,
            timeout=15,
        )
        data = resp.json() if resp.content else {}
        if resp.ok and data.get("success"):
            return True, "ElevenLabs outbound call initiated"
        detail = data.get("detail")
        msg = data.get("message") or (detail.get("message") if isinstance(detail, dict) else str(detail or resp.text or "Unknown response"))
        return False, msg
    except requests.exceptions.RequestException as e:
        err_msg = ""
        if hasattr(e, "response") and e.response is not None:
            try:
                d = e.response.json()
                detail = d.get("detail")
                err_msg = d.get("message") or (detail.get("message") if isinstance(detail, dict) else str(detail))
            except Exception:
                pass
        return False, err_msg or str(e)


def initiate_outbound_call_to_provider(provider_id: str, slot_time_override: Optional[str] = None) -> tuple[bool, str]:
    """
    Initiate ElevenLabs outbound call to a specific provider (booking agent calls the provider).
    Uses ELEVENLABS_PROVIDER_CONFIG for provider's phone_number and optional agent_id.
    Does not block; returns (success, message).
    """
    if not ELEVENLABS_API_KEY:
        return False, "ELEVENLABS_API_KEY not configured"
    if not ELEVENLABS_PHONE_NUMBER_ID:
        return False, "ELEVENLABS_PHONE_NUMBER_ID not configured"

    try:
        from .elevenlabs_config import ELEVENLABS_PROVIDER_CONFIG
        cfg = ELEVENLABS_PROVIDER_CONFIG.get(provider_id)
    except Exception:
        cfg = None

    to_number = ELEVENLABS_OUTBOUND_TO_NUMBER
    agent_id = ELEVENLABS_AGENT_ID
    if cfg:
        if getattr(cfg, "phone_number", None):
            to_number = cfg.phone_number
        if getattr(cfg, "elevenlabs_agent_id", None) and cfg.elevenlabs_ready:
            agent_id = cfg.elevenlabs_agent_id

    if not agent_id:
        return False, "ELEVENLABS_AGENT_ID not configured"
    if not to_number:
        return False, "No outbound number (ELEVENLABS_OUTBOUND_TO_NUMBER or provider phone) configured"

    prompt = DEFAULT_PROMPT_OVERRIDE
    if slot_time_override:
        prompt = (
            f"You are calling to confirm an appointment requested for {slot_time_override}. "
            "Confirm the slot with the receptionist. Use the book_appointment tool when confirmed."
        )

    body = {
        "agent_id": agent_id,
        "agent_phone_number_id": ELEVENLABS_PHONE_NUMBER_ID,
        "to_number": to_number,
    }
    body["conversation_initiation_client_data"] = {"overrides": {"first_message_override": prompt}}

    headers = {"Content-Type": "application/json", "xi-api-key": ELEVENLABS_API_KEY}
    try:
        resp = requests.post(ELEVENLABS_OUTBOUND_URL, json=body, headers=headers, timeout=15)
        data = resp.json() if resp.content else {}
        if resp.ok and data.get("success"):
            return True, "ElevenLabs outbound call initiated"
        detail = data.get("detail")
        msg = data.get("message") or (detail.get("message") if isinstance(detail, dict) else str(detail or resp.text or "Unknown response"))
        return False, msg
    except requests.exceptions.RequestException as e:
        return False, str(e)
