"""
CallPilot - ElevenLabs Voice Agent Configuration
Matches the TypeScript elevenlabs.config.ts specification.
Agentic functions: tool calling as the brain — calendar, provider lookup,
distance, slot validation; clarifying questions and dynamic negotiation.
"""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class VoiceAgentPersona:
    role: str = "Professional medical scheduling assistant"
    tone: str = "Calm, polite, and efficient"

    @property
    def system_prompt(self) -> str:
        return """You are a professional medical scheduling assistant calling on behalf of a patient. Your tone is calm, polite, and efficient.

Your objective:
1. Greet the receptionist and state you are calling to schedule an appointment.
2. Use the query_calendar tool to check the patient's free slots so you only request times that avoid double booking.
3. Ask what appointment slots are available. Use lookup_provider if you need details about this provider (rating, distance).
4. When the receptionist offers a slot, use validate_slot to confirm it does not conflict with the patient's calendar and meets preferences.
5. If a slot is offered before 9:30 AM, politely decline and ask for a later option. Adapt your negotiation: if they have limited slots, ask for the next best time.
6. If information is missing (e.g., exact time, date, or provider name), ask clarifying questions before confirming.
7. Once an acceptable slot is validated, call the book_appointment tool with the provider name, slot time, and your reasoning.
8. Thank the receptionist and end the call.

Constraints:
- Never accept a slot before 9:30 AM. Use validate_slot before committing.
- Do not discuss pricing, insurance, or anything beyond scheduling.
- If no valid slot is available or calendar conflicts, politely end the call without booking.
- Keep the call concise — under 60 seconds when possible.
- When information is missing, ask one clear clarifying question at a time; then adapt your negotiation strategy based on the answer."""


# Agentic functions — tool calling as the brain (calendar, provider lookup, distance, slot validation)
TOOL_DEFINITIONS: Dict[str, Any] = {
    "query_calendar": {
        "type": "function",
        "function": {
            "name": "query_calendar",
            "description": "Check the patient's calendar for available time windows. Use before requesting slots from the receptionist to avoid double booking. Returns free slots for today.",
            "parameters": {
                "type": "object",
                "properties": {
                    "for_date": {"type": "string", "description": "Date to check: 'today', 'tomorrow', or YYYY-MM-DD"},
                },
                "required": [],
            },
        },
    },
    "lookup_provider": {
        "type": "function",
        "function": {
            "name": "lookup_provider",
            "description": "Get provider details: name, Google rating, distance from patient. Use when you need to compare or confirm provider info.",
            "parameters": {
                "type": "object",
                "properties": {
                    "provider_name": {"type": "string", "description": "Name of the provider (e.g., 'Dr. Sarah Chen')"},
                    "provider_id": {"type": "string", "description": "Optional provider ID if known"},
                },
                "required": ["provider_name"],
            },
        },
    },
    "calculate_distance": {
        "type": "function",
        "function": {
            "name": "calculate_distance",
            "description": "Get travel distance and estimated travel time from patient to provider. Use to inform scheduling preference (closer = better).",
            "parameters": {
                "type": "object",
                "properties": {
                    "provider_name": {"type": "string", "description": "Name of the provider"},
                    "provider_address": {"type": "string", "description": "Provider address if known"},
                },
                "required": ["provider_name"],
            },
        },
    },
    "validate_slot": {
        "type": "function",
        "function": {
            "name": "validate_slot",
            "description": "Validate a proposed appointment slot: checks patient calendar for conflicts (double booking) and that the time is not before 9:30 AM. Call before confirming with the receptionist.",
            "parameters": {
                "type": "object",
                "properties": {
                    "slot_time": {"type": "string", "description": "Proposed time (e.g., '10:30 AM')"},
                    "provider_name": {"type": "string", "description": "Provider name for logging"},
                },
                "required": ["slot_time", "provider_name"],
            },
        },
    },
    "book_appointment": {
        "type": "function",
        "function": {
            "name": "book_appointment",
            "description": "Confirm and book an appointment slot. Call only after validate_slot has confirmed the slot is free and valid. Call once the receptionist confirms an available slot (9:30 AM or later).",
            "parameters": {
                "type": "object",
                "properties": {
                    "provider_name": {"type": "string", "description": "Name of the dental provider (e.g., 'Dentist A')"},
                    "slot_time": {"type": "string", "description": "The confirmed appointment time (e.g., '10:30 AM')"},
                    "reasoning": {"type": "string", "description": "Brief explanation for choosing this slot"},
                },
                "required": ["provider_name", "slot_time", "reasoning"],
            },
        },
    },
}


@dataclass
class WebhookConfig:
    endpoint: str = "/call-status"
    method: str = "POST"
    expected_headers: Dict[str, str] = None

    def __post_init__(self):
        if self.expected_headers is None:
            self.expected_headers = {"content-type": "application/json"}


@dataclass
class ProviderElevenLabsConfig:
    elevenlabs_ready: bool
    elevenlabs_agent_id: Optional[str]
    phone_number: str
    provider_name: str


ELEVENLABS_PROVIDER_CONFIG = {
    "agent-1": ProviderElevenLabsConfig(True, "placeholder-agent-id-dentist-a", "+1-555-0001", "Dentist A"),
    "agent-2": ProviderElevenLabsConfig(False, None, "+1-555-0002", "Dentist B"),
    "agent-3": ProviderElevenLabsConfig(False, None, "+1-555-0003", "Dentist C"),
    "agent-4": ProviderElevenLabsConfig(False, None, "+1-555-0004", "Dentist D"),
    "agent-5": ProviderElevenLabsConfig(False, None, "+1-555-0005", "Dentist E"),
}


@dataclass
class VoiceConfig:
    voice_id: str = "JBFqnCBsd6RMkjVDRZzb"
    voice_name: str = "George"
    model: str = "eleven_turbo_v2_5"


VOICE_AGENT_PERSONA = VoiceAgentPersona()
WEBHOOK_CONFIG = WebhookConfig()
VOICE_CONFIG = VoiceConfig()
