"""
CallPilot - Support Agent Webhook Handler

ElevenLabs POSTs Support agent tool calls here.
URL: POST /support-agent/webhook

Configure in ElevenLabs: Support Agent → Tools → Webhook URL
  https://your-domain.com/support-agent/webhook
"""
from typing import Any, Dict

from fastapi import APIRouter, Request, HTTPException

from .support_agent_config import SUPPORT_AGENT_PERSONA, SUPPORT_AGENT_TOOLS
from .support_agent_tools import run_support_tool, infer_tool_from_input
from .booking_orchestration import trigger_booking_orchestration
from .language import detect_language, get_language_hint_for_prompt
from .domain_experts import get_expert_routing_for_tool_result

router = APIRouter(prefix="/support-agent", tags=["support-agent"])


@router.get("")
async def support_agent_health() -> Dict[str, Any]:
    """Verify the Support agent routes are deployed. GET /support-agent → 200 means webhook URL is correct."""
    return {
        "status": "ok",
        "agent": "CallPilot Support Agent",
        "webhook": "POST /support-agent/webhook",
    }


@router.post("/webhook")
async def support_agent_webhook(request: Request) -> Dict[str, Any]:
    """
    Handle tool calls from the Support agent (Find Doctor, Find Dentist, etc.).
    Accepts:
      - { "tool_name": "...", "arguments": { ... } } or { "name": "...", "parameters": { ... } }
      - ElevenLabs style: { "input": "dentist" } → treated as find_provider(service_type="dentist")
    Returns { "status": "success", "tool_result": { ... } } so the agent can use the result.
    """
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Tool name: body first, then headers, then infer from payload (ElevenLabs often sends only tool params)
    tool_name = (
        data.get("tool_name")
        or data.get("name")
        or (request.headers.get("x-elevenlabs-tool-name") or request.headers.get("x-tool-name") or "").strip()
    )
    # Arguments: explicit arguments/parameters, or nested "input" object (ElevenLabs envelope format)
    raw_input = data.get("input")
    if isinstance(raw_input, dict):
        arguments = raw_input
    else:
        arguments = data.get("arguments") or data.get("parameters") or {}

    # ElevenLabs sometimes sends only tool parameters in the body (no tool_name). Infer the tool.
    if not tool_name:
        raw_input = data.get("input")
        if raw_input is not None and isinstance(raw_input, str):
            input_str = raw_input.strip()
            if input_str:
                # "check availability for Dr. Sarah Chen" / "try sarah chen" → check_availability(provider_name)
                inferred = infer_tool_from_input(input_str)
                if inferred:
                    tool_name = inferred.get("tool_name")
                    arguments = inferred.get("arguments") or arguments
                else:
                    tool_name = "find_provider"
                    arguments = {"service_type": input_str or "doctor"}
            else:
                tool_name = "find_provider"
                arguments = {"service_type": "doctor"}
        elif raw_input is not None and not isinstance(raw_input, dict):
            tool_name = "find_provider"
            arguments = {"service_type": str(raw_input).strip() or "doctor"}
        elif "provider_name" in data and "new_slot_time" in data:
            # reschedule_appointment: provider_name, new_slot_time, optional reasoning
            tool_name = "reschedule_appointment"
            arguments = {
                "provider_name": data.get("provider_name"),
                "new_slot_time": data.get("new_slot_time"),
                "reason": data.get("reasoning"),
            }
        elif "provider_name" in data and "service_type" in data and "reasoning" in data:
            # schedule_appointment: provider_name, slot_time, service_type, reasoning
            tool_name = "schedule_appointment"
            arguments = {
                "provider_name": data.get("provider_name"),
                "slot_time": data.get("slot_time"),
                "service_type": data.get("service_type"),
                "reasoning": data.get("reasoning"),
            }
        elif "provider_name" in data and "slot_time" in data:
            tool_name = "validate_slot"
            arguments = {"provider_name": data.get("provider_name"), "slot_time": data.get("slot_time")}
        elif "provider_name" in data and "reasoning" in data and "service_type" not in data:
            # cancel_appointment: provider_name, optional reasoning (no service_type → not schedule_appointment)
            tool_name = "cancel_appointment"
            arguments = {
                "provider_name": data.get("provider_name"),
                "reason": data.get("reasoning"),
            }
        elif "provider_name" in data and data.get("for_date") is not None:
            tool_name = "check_availability"
            arguments = {"provider_name": data.get("provider_name"), "for_date": data.get("for_date")}
        elif "provider_name" in data and ("preferred_times" in data or "callback_phone" in data):
            # register_waitlist: provider_name, optional preferred_times, callback_phone
            tool_name = "register_waitlist"
            arguments = {
                "provider_name": data.get("provider_name"),
                "preferred_times": data.get("preferred_times"),
                "callback_phone": data.get("callback_phone"),
            }
        elif "provider_name" in data:
            tool_name = "get_provider_details"
            arguments = {"provider_name": data.get("provider_name"), "provider_id": data.get("provider_id")}
        elif "service_type" in data and not ("provider_name" in data and "reasoning" in data):
            tool_name = "find_provider"
            arguments = {
                "service_type": data.get("service_type"),
                "location": data.get("location"),
                "max_distance_miles": data.get("max_distance_miles"),
                "min_rating": data.get("min_rating"),
            }
        elif "for_date" in data or not data:
            tool_name = "query_calendar"
            arguments = {"for_date": data.get("for_date") if data else "today"}
        elif "intent" in data and not data.get("tool_name") and not data.get("name"):
            # list_my_appointments: body with only "intent" (ElevenLabs schema)
            tool_name = "list_my_appointments"
            arguments = {}
        elif "reason" in data and "provider_name" not in data:
            # request_human_handover: reason, optional confidence
            tool_name = "request_human_handover"
            arguments = {
                "reason": data.get("reason"),
                "confidence": data.get("confidence"),
            }

    if not tool_name:
        raise HTTPException(status_code=400, detail="Missing tool_name, name, or input")

    # Normalize: ElevenLabs tool may be named "book_appointment" — backend uses "schedule_appointment"
    if tool_name.strip().lower() == "book_appointment":
        tool_name = "schedule_appointment"
        if not arguments and isinstance(data.get("input"), dict):
            arguments = data.get("input") or {}
        if not arguments.get("slot_time") and data.get("slot_time"):
            arguments = dict(arguments) if arguments else {}
            arguments["slot_time"] = data.get("slot_time")
        if not arguments.get("provider_name") and data.get("provider_name"):
            arguments = dict(arguments) if arguments else {}
            arguments["provider_name"] = data.get("provider_name")
            arguments["service_type"] = arguments.get("service_type") or data.get("service_type")
            arguments["reasoning"] = arguments.get("reasoning") or data.get("reasoning")

    # Automatic language detection from user message (for multilingual support)
    user_message = (
        data.get("user_message")
        or data.get("user_input")
        or (data.get("input") if isinstance(data.get("input"), str) else None)
    )
    detected_lang = detect_language(user_message) if user_message else "en"
    context = {
        "user_id": data.get("user_id"),
        "conversation_id": data.get("conversation_id"),
        "agent_id": request.headers.get("x-elevenlabs-agent-id") or data.get("agent_id"),
        "detected_language": detected_lang,
        "language_hint": get_language_hint_for_prompt(detected_lang),
    }

    result = run_support_tool(tool_name, arguments, context)

    # schedule_appointment is a signal: backend triggers booking (live call or simulated), return 200 immediately
    if tool_name == "schedule_appointment" and result.get("success"):
        print("schedule_appointment received — booking approved", flush=True)
        broadcast = getattr(request.app.state, "broadcast", None)
        if broadcast:
            swarm_id = trigger_booking_orchestration(
                broadcast=broadcast,
                provider_name=result.get("provider_name", arguments.get("provider_name") or ""),
                slot_time=result.get("slot_time", arguments.get("slot_time") or ""),
                service_type=result.get("service_type", arguments.get("service_type") or ""),
                reasoning=result.get("reasoning", arguments.get("reasoning") or ""),
            )
            if swarm_id:
                result = {**result, "booking_initiated": True, "swarm_id": swarm_id}
        result["message"] = "Booking initiated. You will receive confirmation via the app or when the call completes."

    # Hallucination-aware handover: emit to Support session WS so UI can show "connecting to human"
    if tool_name == "request_human_handover" and result.get("handover"):
        broadcast_support = getattr(request.app.state, "broadcast_support", None)
        session_id = context.get("conversation_id") or data.get("conversation_id")
        if broadcast_support and session_id:
            broadcast_support(session_id, "support:human_handover", {
                "reason": result.get("reason"),
                "confidence": result.get("confidence"),
            })

    # Multilingual: include hint in response so agent/next turn can use it
    if detected_lang and detected_lang != "en":
        result["language_hint"] = context.get("language_hint")

    # Domain expert routing: suggest health/fitness_therapy expert when deeper knowledge may be needed
    service_type = arguments.get("service_type") or data.get("service_type")
    expert_routing = get_expert_routing_for_tool_result(user_message, service_type)
    if expert_routing.get("suggested_expert") != "general":
        result["suggested_expert"] = expert_routing.get("suggested_expert")
        if expert_routing.get("expert_prompt_hint"):
            result["expert_prompt_hint"] = expert_routing["expert_prompt_hint"]

    return {"status": "success", "tool_result": result}


@router.post("/waitlist-check")
async def support_waitlist_check(request: Request):
    """
    Run waitlist retry logic: check for open slots and notify pending entries.
    Call periodically (e.g. cron) or on demand. Returns count of notified entries.
    """
    from .waitlist_retry import check_waitlist_and_notify
    broadcast_support = getattr(request.app.state, "broadcast_support", None)
    notified = check_waitlist_and_notify(broadcast_support=broadcast_support)
    return {"status": "ok", "notified_count": len(notified), "notified": notified}


@router.get("/config")
async def support_agent_config():
    """Return system prompt and tool list for reference (e.g. copying into ElevenLabs dashboard)."""
    return {
        "agent": "Support Agent",
        "system_prompt": SUPPORT_AGENT_PERSONA.system_prompt,
        "webhook_url_path": "/support-agent/webhook",
        "tool_names": list(SUPPORT_AGENT_TOOLS.keys()),
    }
