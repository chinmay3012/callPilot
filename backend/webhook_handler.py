"""
CallPilot - ElevenLabs Webhook Handler
Receives tool calls from ElevenLabs webhook tools.
Agentic functions: executes query_calendar, lookup_provider, calculate_distance,
validate_slot and returns results to the agent; book_appointment updates swarm.
"""
import re
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import APIRouter, Request, HTTPException

from .swarm import get_swarm_by_agent, get_swarm
from . import swarm as swarm_mod
from .elevenlabs_config import WEBHOOK_CONFIG
from .agent_tools import run_tool
from .calendar_service import check_double_booking


router = APIRouter(prefix="/call-status", tags=["webhooks"])


def normalize_slot_time(slot_time: Optional[str]) -> str:
    """
    Normalize slot_time from formats like:
    - "Today at 9:30 AM"
    - "Tomorrow at 11:00 AM"
    - "9:30 AM"
    -> Extract time as "9:30 AM", "11:00 AM"
    """
    if not slot_time or not isinstance(slot_time, str):
        return "9:30 AM"
    s = slot_time.strip()
    # Match "HH:MM AM/PM" or "H:MM AM/PM"
    match = re.search(r"(\d{1,2}:\d{2}\s*(?:AM|PM))", s, re.IGNORECASE)
    if match:
        return match.group(1).strip().upper().replace("am", "AM").replace("pm", "PM")
    return s


@router.post("")
async def handle_call_status(request: Request):
    """
    ElevenLabs webhook endpoint for all agent tools.
    - For query_calendar, lookup_provider, calculate_distance, validate_slot:
      execute tool and return result so the agent can use it mid-conversation.
    - For book_appointment: update swarm and return confirmation.
    """
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Agentic tool call (single tool with name + arguments) — execute or book
    tool_name = data.get("tool_name") or data.get("name")
    arguments = data.get("arguments") or data.get("parameters") or {}
    if tool_name and tool_name != "book_appointment":
        agent_id = request.headers.get("x-elevenlabs-agent-id") or data.get("agent_id")
        context = {"user_id": data.get("user_id"), "agent_id": agent_id}
        result = run_tool(tool_name, arguments, context)
        return {"status": "success", "tool_result": result}

    # book_appointment as tool_name + arguments (agentic format)
    if tool_name == "book_appointment" and arguments:
        provider_name = arguments.get("provider_name", "")
        slot_time_raw = arguments.get("slot_time", "")
        reasoning = arguments.get("reasoning", "")
        slot_time = normalize_slot_time(slot_time_raw)
        # Real-time calendar check to prevent double booking
        calendar_ok = check_double_booking(slot_time, data.get("user_id"))
        booking_confirmed = calendar_ok.get("available", True)
        agent_id = request.headers.get("x-elevenlabs-agent-id") or data.get("agent_id")
        swarm = get_swarm_by_agent(agent_id) if agent_id else None
        if not swarm:
            swarms = getattr(swarm_mod, "_swarms", {})
            for _sid, s in swarms.items():
                if not s.completed and s.agents:
                    agent_id = s.agents[0].id
                    swarm = s
                    break
        if swarm and agent_id and not swarm.completed:
            swarm.process_webhook_result(
                agent_id=agent_id,
                call_status="completed",
                offered_slot=slot_time,
                booking_confirmed=booking_confirmed,
                tool_calls=[{"tool_name": "book_appointment", "parameters": {"provider_name": provider_name, "slot_time": slot_time, "reasoning": reasoning}}],
            )
            if booking_confirmed:
                print("ElevenLabs booking confirmed via webhook", flush=True)
        return {
            "status": "success",
            "booking_confirmed": booking_confirmed,
            "confirmation_message": f"Appointment confirmed with {provider_name} at {slot_time}" if booking_confirmed else f"Slot {slot_time} conflicts with calendar; ask for another time.",
        }

    # Format 1: Direct from ElevenLabs webhook tool (request_body_schema)
    if "provider_name" in data and "slot_time" in data:
        provider_name = data.get("provider_name", "")
        slot_time_raw = data.get("slot_time", "")
        reasoning = data.get("reasoning", "")
        slot_time = normalize_slot_time(slot_time_raw)

        print(f"📞 book_appointment webhook received")
        print(f"   Provider: {provider_name}")
        print(f"   Slot (raw): {slot_time_raw} -> (normalized): {slot_time}")
        print(f"   Reasoning: {reasoning}")

        # Try to find active swarm (agent_id may be in header when ElevenLabs sends it)
        agent_id = request.headers.get("x-elevenlabs-agent-id") or data.get("agent_id")
        swarm = get_swarm_by_agent(agent_id) if agent_id else None
        if not swarm:
            swarms = getattr(swarm_mod, "_swarms", {})
            for _sid, s in swarms.items():
                if not s.completed and s.agents:
                    agent_id = s.agents[0].id
                    swarm = s
                    break

        if swarm and agent_id and not swarm.completed:
            swarm.process_webhook_result(
                agent_id=agent_id,
                call_status="completed",
                offered_slot=slot_time,
                booking_confirmed=True,
                tool_calls=[{"tool_name": "book_appointment", "parameters": {"provider_name": provider_name, "slot_time": slot_time, "reasoning": reasoning}}],
            )
            print("ElevenLabs booking confirmed via webhook", flush=True)

        print(f"✅ Appointment booked! Provider: {provider_name}, Time: {slot_time}")
        return {
            "status": "success",
            "booking_confirmed": True,
            "confirmation_message": f"Appointment confirmed with {provider_name} at {slot_time}",
        }

    # Format 2: Wrapped format (event, agent_id, data) - legacy
    event = data.get("event")
    agent_id = data.get("agent_id")
    event_data = data.get("data", {})

    if event and agent_id:
        if event == "tool_call":
            return await _handle_tool_call(agent_id, event_data)
        elif event == "call_started":
            return await _handle_call_started(agent_id, event_data)
        elif event == "call_ended":
            return await _handle_call_ended(agent_id, event_data)
        elif event == "transcription":
            return await _handle_transcription(agent_id, event_data)
        return {"status": "ignored", "event": event}

    raise HTTPException(status_code=400, detail="Expected provider_name and slot_time, or event and agent_id")


async def _handle_tool_call(agent_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    tool_name = data.get("tool_name")
    arguments = data.get("arguments", data)

    if tool_name == "book_appointment" or "provider_name" in arguments:
        provider_name = arguments.get("provider_name")
        slot_time_raw = arguments.get("slot_time")
        slot_time = normalize_slot_time(slot_time_raw)
        reasoning = arguments.get("reasoning", "")

        swarm = get_swarm_by_agent(agent_id)
        if swarm and not swarm.completed:
            swarm.process_webhook_result(
                agent_id=agent_id,
                call_status="completed",
                offered_slot=slot_time,
                booking_confirmed=True,
                tool_calls=[{"tool_name": "book_appointment", "parameters": {"provider_name": provider_name, "slot_time": slot_time, "reasoning": reasoning}}],
            )
            print("ElevenLabs booking confirmed via webhook", flush=True)

        print(f"✅ Appointment booked! Provider: {provider_name}, Time: {slot_time}")
        return {
            "status": "success",
            "booking_confirmed": True,
            "confirmation_message": f"Booked {provider_name} at {slot_time}",
        }

    return {"status": "error", "message": f"Unknown tool: {tool_name}"}


async def _handle_call_started(agent_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    print(f"📞 Call started: {agent_id} → {data.get('provider_name')}")
    return {"status": "acknowledged"}


async def _handle_call_ended(agent_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    print(f"📞 Call ended: {agent_id} Duration: {data.get('duration_seconds')}s")
    return {"status": "acknowledged"}


async def _handle_transcription(agent_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    if data.get("is_final"):
        print(f"💬 [{agent_id}] {data.get('role')}: {data.get('content')}")
    return {"status": "acknowledged"}


@router.get("/health")
async def webhook_health():
    return {
        "status": "healthy",
        "endpoint": WEBHOOK_CONFIG.endpoint,
        "timestamp": datetime.utcnow().isoformat(),
    }
