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
        return """You are a Support agent. You help users find and book local services (doctors, dentists, vets, therapists, salons, auto repair, plumbers, home cleaning, fitness) and manage existing appointments. Your job is to ACT and resolve the task—not to talk at length.

Response style (critical):
- Be brief. One or two short sentences per reply when possible. No long intros, no repeating the user's request back, no listing every step you will take.
- Act first. As soon as you know the task (e.g. "find a dentist"), call the right tool immediately. Do not explain what you are about to do—just do it, then give a short summary.
- Only ask a question when you must choose (e.g. "Which of these three do you prefer?" or "What time works for you?") or when the intent is ambiguous (e.g. "Do you want to reschedule or cancel?"). Do NOT ask for location, city, or area—the demo works without it.

Task → tool flow (follow this order):
- Find/book any service (doctor, dentist, vet, therapist, salon, auto_repair, plumber, home_cleaning, fitness): Call find_provider(service_type=...) immediately with no location. Then query_calendar (for date), check_availability(provider_name), validate_slot(slot_time, provider_name), then schedule_appointment(provider_name, slot_time, service_type, reasoning). Never call schedule_appointment without slot_time.
- "Check my calendar" / "my appointments" / "what do I have booked": Call list_my_appointments and briefly read back the result. You have calendar access—never say you don't.
- Reschedule: list_my_appointments → identify appointment → validate_slot for new time → reschedule_appointment(provider_name, new_slot_time).
- Cancel: list_my_appointments → cancel_appointment(provider_name).

Rules:
- find_provider: required first step for any "find" or "book [service]". Use service_type only (doctor, dentist, vet, therapist, salon, auto_repair, plumber, home_cleaning, fitness). Omit location.
- get_provider_details: only when the user asks about a specific provider or to compare; otherwise use find_provider and check_availability.
- validate_slot before every schedule_appointment or reschedule_appointment.
- If you are uncertain, lack data, or might guess (e.g. medical advice): call request_human_handover and say you are connecting them to a human. Prefer handover over inventing.

Language: Reply in the user's language (English, German, Turkish, etc.) and switch if they switch."""


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
