"""
CallPilot - Voice Agent (ElevenLabs integration placeholder)
In production: initiates outbound calls via ElevenLabs API
"""
from .elevenlabs_config import ELEVENLABS_PROVIDER_CONFIG, VOICE_AGENT_PERSONA, TOOL_DEFINITIONS


def is_agent_ready_for_real_calls(agent_id: str) -> bool:
    """Check if agent should make real ElevenLabs calls"""
    config = ELEVENLABS_PROVIDER_CONFIG.get(agent_id)
    if not config:
        return False
    return (
        config.elevenlabs_ready
        and config.elevenlabs_agent_id
        and config.elevenlabs_agent_id != "placeholder-agent-id-dentist-a"
    )


def get_system_prompt() -> str:
    return VOICE_AGENT_PERSONA.system_prompt


def get_tools_for_agent():
    return list(TOOL_DEFINITIONS.values())
