"""
CallPilot - Support Agent Configuration for ElevenLabs

A voice agent for daily-life tasks that most startups don't fully solve:
- Find Doctor (primary care, specialists)
- Find Dentist
- Find Vet, Plumber, Salon, Auto repair, etc.
- Check availability and book appointments

Use this config in the ElevenLabs dashboard to create a separate "Support Agent"
that helps users find and schedule real-world services via conversation.

Setup in ElevenLabs:
  1. Create a new Conversational AI agent (e.g. "CallPilot Support").
  2. Paste SUPPORT_AGENT_PERSONA.system_prompt into Agent → Prompt → System Prompt.
  3. Add each tool from SUPPORT_AGENT_TOOLS under Agent → Tools → Custom Tool.
  4. Set webhook URL to: https://your-domain.com/support-agent/webhook
  5. Use the same voice/model settings as the scheduling agent if desired.
"""
from typing import Any, Dict
from dataclasses import dataclass


@dataclass
class SupportAgentPersona:
    role: str = "Daily life support assistant"
    tone: str = "Warm, patient, and helpful"

    @property
    def system_prompt(self) -> str:
        return """You are a Support agent helping people with everyday tasks that are frustrating and under-served: finding doctors, dentists, vets, plumbers, salons, auto repair, and other local services—then helping them book or schedule.

You support these real-world tasks end-to-end (find → decide → act):
- Find & book a doctor
- Find & book a dentist
- Find & book a vet
- Find & book a therapist
- Book a haircut / salon appointment
- Call & schedule auto repair
- Find & call a plumber
- Find & schedule home cleaning
- Schedule a fitness class / personal trainer
- Reschedule or cancel an existing appointment (use list_my_appointments, then reschedule_appointment or cancel_appointment)

Prototype/demo behavior: Do NOT ask for location, city, or area. The demo works without it. Call find_provider with only service_type (and optional min_rating or max_distance_miles only if the user mentions them). Proceed straight to finding providers and suggesting options.

Your goals:
1. Understand what the user needs. Do not ask for location—call find_provider immediately with the right service_type. Only ask clarifying questions when truly needed (e.g. "Which appointment?" when rescheduling multiple, or "What time works for you?" when booking).
2. Use find_provider to search for matching providers by service_type: doctor, dentist, vet, therapist, salon, auto_repair, plumber, home_cleaning, fitness. Always call this first. Omit location; the backend returns demo providers without it.
3. Use query_calendar to see when the user is free, so you only suggest times that don't conflict with their schedule.
4. Use get_provider_details when you need more info about a specific provider (rating, distance, hours).
5. Use check_availability to see what slots a provider has, or when they're next available.
6. Use validate_slot before confirming any time—it checks the user's calendar to prevent double booking.
7. When the user is ready to book, use schedule_appointment. You must always include slot_time in that call. Use the exact date and time the user gave (e.g. "3:30 PM", "Tomorrow at 3:30 PM"). If the user just said a time, include it in your next schedule_appointment call—never call schedule_appointment without slot_time.
8. For reschedule: list_my_appointments → identify provider → validate_slot for new time → reschedule_appointment(provider_name, new_slot_time). For cancel: list_my_appointments → cancel_appointment(provider_name).
9. You HAVE access to the user's appointments and calendar. When the user asks to "check my calendar", "see my appointments", "what do I have booked", "show my bookings", "what's on my calendar", or similar, ALWAYS call list_my_appointments and read back the result. Never say you do not have access to their calendar—you do, via the list_my_appointments tool.

Multilingual: Respond in the user's language. If they speak German, Turkish, or another language, reply in that language and switch seamlessly if they change (e.g. German → English). You will receive a language_hint in context when detected.

Self-awareness over fluency: If you are uncertain, lack information, or risk guessing (e.g. medical advice, specific policy), use request_human_handover and say you are connecting them to a human. Prefer handover over sounding confident when you might be wrong."""


# Tool definitions for the Support agent (paste into ElevenLabs as Custom Tools)
SUPPORT_AGENT_TOOLS: Dict[str, Any] = {
    "find_provider": {
        "type": "function",
        "function": {
            "name": "find_provider",
            "description": "Search for providers by service_type: doctor, dentist, vet, therapist, salon, auto_repair, plumber, home_cleaning, fitness. Call this first when the user asks to find/book a doctor, dentist, vet, therapist, haircut/salon, auto repair, plumber, home cleaning, or fitness class/personal trainer.",
            "parameters": {
                "type": "object",
                "properties": {
                    "service_type": {
                        "type": "string",
                        "description": "Type of service: doctor, dentist, vet, therapist, salon, auto_repair, plumber, home_cleaning, fitness.",
                    },
                    "location": {"type": "string", "description": "Optional. Do not ask the user for location in demo—omit this; providers are returned without it."},
                    "max_distance_miles": {"type": "number", "description": "Maximum distance in miles. Optional, default 10."},
                    "min_rating": {"type": "number", "description": "Minimum rating 0-5. Optional."},
                },
                "required": ["service_type"],
            },
        },
    },
    "query_calendar": {
        "type": "function",
        "function": {
            "name": "query_calendar",
            "description": "Get the user's free time windows for a date. Use before suggesting appointment times to avoid double booking.",
            "parameters": {
                "type": "object",
                "properties": {
                    "for_date": {"type": "string", "description": "'today', 'tomorrow', or YYYY-MM-DD"},
                },
                "required": [],
            },
        },
    },
    "get_provider_details": {
        "type": "function",
        "function": {
            "name": "get_provider_details",
            "description": "Get full details for one provider: rating, distance, address, hours. Use when the user asks about a specific place or to compare options.",
            "parameters": {
                "type": "object",
                "properties": {
                    "provider_name": {"type": "string", "description": "Name of the provider or business"},
                    "provider_id": {"type": "string", "description": "Provider ID if known"},
                },
                "required": ["provider_name"],
            },
        },
    },
    "check_availability": {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Check when a provider has available slots or their next available time. Use to answer 'when can I get in?' or 'do they have anything tomorrow?'",
            "parameters": {
                "type": "object",
                "properties": {
                    "provider_name": {"type": "string", "description": "Name of the provider"},
                    "for_date": {"type": "string", "description": "'today', 'tomorrow', or YYYY-MM-DD. Optional."},
                },
                "required": ["provider_name"],
            },
        },
    },
    "validate_slot": {
        "type": "function",
        "function": {
            "name": "validate_slot",
            "description": "Check if a proposed appointment time is free on the user's calendar (no double booking) and valid. Call before confirming any booking.",
            "parameters": {
                "type": "object",
                "properties": {
                    "slot_time": {"type": "string", "description": "Proposed time, e.g. '10:30 AM' or '2:00 PM tomorrow'"},
                    "provider_name": {"type": "string", "description": "Name of the provider (for confirmation message)"},
                },
                "required": ["slot_time", "provider_name"],
            },
        },
    },
    "schedule_appointment": {
        "type": "function",
        "function": {
            "name": "schedule_appointment",
            "description": "Confirm and schedule an appointment. Call only after validate_slot says the slot is free. Include service type so the user gets a clear confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "provider_name": {"type": "string", "description": "Name of the provider or business"},
                    "slot_time": {"type": "string", "description": "Confirmed time (e.g. '10:30 AM Tuesday')"},
                    "service_type": {"type": "string", "description": "Type of appointment: doctor, dentist, vet, plumber, salon, etc."},
                    "reasoning": {"type": "string", "description": "Brief reason for this choice (e.g. 'Earliest slot that fits your calendar')"},
                },
                "required": ["provider_name", "slot_time", "service_type", "reasoning"],
            },
        },
    },
    "list_my_appointments": {
        "type": "function",
        "function": {
            "name": "list_my_appointments",
            "description": "List the user's existing appointments (upcoming and recent). Use when they ask to reschedule, cancel, or see their bookings.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    "reschedule_appointment": {
        "type": "function",
        "function": {
            "name": "reschedule_appointment",
            "description": "Reschedule an existing appointment to a new time. Call after list_my_appointments to identify the appointment, then validate_slot for the new time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "provider_name": {"type": "string", "description": "Provider of the existing appointment"},
                    "new_slot_time": {"type": "string", "description": "New requested time (e.g. '2:00 PM Thursday')"},
                    "reason": {"type": "string", "description": "Optional reason (e.g. 'User requested different day')"},
                },
                "required": ["provider_name", "new_slot_time"],
            },
        },
    },
    "cancel_appointment": {
        "type": "function",
        "function": {
            "name": "cancel_appointment",
            "description": "Cancel an existing appointment. Use when the user clearly wants to cancel. Confirm which appointment (provider name) before calling.",
            "parameters": {
                "type": "object",
                "properties": {
                    "provider_name": {"type": "string", "description": "Provider of the appointment to cancel"},
                    "reason": {"type": "string", "description": "Optional reason for cancellation"},
                },
                "required": ["provider_name"],
            },
        },
    },
    "request_human_handover": {
        "type": "function",
        "function": {
            "name": "request_human_handover",
            "description": "Transfer to a human when you are uncertain, lack information, or risk fabrication (e.g. medical advice, policy). Prefer self-awareness over sounding fluent. Call this and tell the user you are connecting them to a team member.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "Why handover is needed (e.g. 'User asked medical advice', 'Unclear insurance policy')"},
                    "confidence": {"type": "string", "description": "low | medium | high — how uncertain you are"},
                },
                "required": ["reason"],
            },
        },
    },
    "register_waitlist": {
        "type": "function",
        "function": {
            "name": "register_waitlist",
            "description": "Add the user to a provider's waitlist for a callback when a slot opens. Use when no slots are available but the user wants to be notified.",
            "parameters": {
                "type": "object",
                "properties": {
                    "provider_name": {"type": "string", "description": "Provider to join waitlist for"},
                    "preferred_times": {"type": "string", "description": "Optional: e.g. 'mornings', 'any'"},
                    "callback_phone": {"type": "string", "description": "Optional: phone for callback"},
                },
                "required": ["provider_name"],
            },
        },
    },
}


SUPPORT_AGENT_PERSONA = SupportAgentPersona()
