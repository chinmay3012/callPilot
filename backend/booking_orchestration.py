"""
CallPilot - Booking Orchestration

When the Support Agent calls schedule_appointment (user approval), the backend:
- Resolves provider by name (no hardcoding)
- If provider.elevenlabsReady: initiates ElevenLabs outbound call (booking agent)
- Else: simulated booking, emit agent:booked / swarm:completed for UI

Support Agent never calls book_appointment; only the backend triggers the booking agent.
"""
import asyncio
from typing import Any, Callable, Dict, Optional

from . import swarm as swarm_mod
from .models import ProviderAgent, AgentStatus
from .provider_service import load_providers
from .support_agent_tools import _load_support_services
from .live_call import initiate_outbound_call_to_provider


def resolve_provider(provider_name: str) -> Optional[Dict[str, Any]]:
    """
    Resolve provider by name from mock_providers and support_services.
    Returns dict with id, name, elevenlabsReady (from ELEVENLABS_PROVIDER_CONFIG).
    Do not hardcode provider names; match case-insensitively and by substring.
    """
    if not provider_name or not isinstance(provider_name, str):
        return None
    name = provider_name.strip()
    name_lower = name.lower()

    # Dentists / mock_providers
    dentists = load_providers(service_type="dentist", max_count=20)
    for p in dentists:
        if name_lower in (p.get("name") or "").lower() or (p.get("name") or "").lower() in name_lower:
            elevenlabs_ready = bool(p.get("elevenlabsReady", False))
            try:
                from .elevenlabs_config import ELEVENLABS_PROVIDER_CONFIG
                cfg = ELEVENLABS_PROVIDER_CONFIG.get(p.get("id"))
                if cfg:
                    elevenlabs_ready = bool(cfg.elevenlabs_ready)
            except Exception:
                pass
            return {
                "id": p.get("id"),
                "name": p.get("name", p.get("id")),
                "elevenlabsReady": elevenlabs_ready,
            }

    # support_services (doctor, vet, plumber, etc.) — no per-provider ElevenLabs in config, so not ready
    services = _load_support_services()
    for _st, providers in services.items():
        for p in providers:
            pname = (p.get("name") or "").strip()
            if name_lower in pname.lower() or pname.lower() in name_lower:
                return {
                    "id": p.get("id"),
                    "name": pname,
                    "elevenlabsReady": False,
                }

    return None


def _create_support_swarm_and_register(
    broadcast: Callable[[str, str, dict], None],
    provider_id: str,
    provider_name: str,
) -> tuple[str, swarm_mod.SwarmOrchestrator]:
    """Create a one-agent swarm for support-triggered booking and register for webhook lookup.
    broadcast(swarm_id, event, payload) is the main app broadcast.
    """
    swarm_id_ref: list = []

    def _swarm_broadcast(event: str, payload: dict) -> None:
        if swarm_id_ref:
            broadcast(swarm_id_ref[0], event, payload)

    swarm = swarm_mod.SwarmOrchestrator(broadcast=_swarm_broadcast)
    swarm_id_ref.append(swarm.swarm_id)
    swarm.agents = [
        ProviderAgent(
            id=provider_id,
            name=provider_name,
            status=AgentStatus.SEARCHING,
            slotTime=None,
            elevenlabsReady=True,
        )
    ]
    swarm_id = swarm.swarm_id
    swarm_mod._swarms[swarm_id] = swarm
    for a in swarm.agents:
        swarm_mod._agent_to_swarm[a.id] = swarm_id
    return swarm_id, swarm


def _emit_support_booking_completed(
    swarm: swarm_mod.SwarmOrchestrator,
    slot_time: str,
) -> None:
    """Mark the single agent as booked and emit agent:booked + swarm:completed."""
    if not swarm.agents:
        return
    agent = swarm.agents[0]
    swarm._update_agent(agent.id, AgentStatus.BOOKED, slot_time)
    swarm.winner = swarm.agents[0]
    swarm._emit("agent:booked", {
        "swarmId": swarm.swarm_id,
        "agentId": agent.id,
        "providerName": agent.name,
        "slotTime": slot_time,
    })
    swarm._emit("swarm:completed", {
        "swarmId": swarm.swarm_id,
        "winnerId": agent.id,
        "winnerName": agent.name,
        "winnerSlot": slot_time,
        "allAgents": [a.model_dump() for a in swarm.agents],
        "rankedShortlist": [{"rank": 1, "agentId": agent.id, "providerName": agent.name, "slotTime": slot_time, "score": 1.0}],
    })
    swarm._cleanup_registry()


def trigger_booking_orchestration(
    broadcast: Callable[[str, str, dict], None],
    provider_name: str,
    slot_time: str,
    service_type: str,
    reasoning: str,
) -> Optional[str]:
    """
    Start booking orchestration (non-blocking). Returns swarm_id for UI subscription, or None.
    - If provider.elevenlabsReady: initiate ElevenLabs outbound call; webhook will complete.
    - Else: simulated booking, emit agent:booked and swarm:completed immediately.
    """
    provider = resolve_provider(provider_name)
    if not provider:
        print("schedule_appointment received — booking approved; provider not found, skipping orchestration", flush=True)
        return None

    pid = provider.get("id")
    pname = provider.get("name", provider_name)
    elevenlabs_ready = bool(provider.get("elevenlabsReady", False))

    swarm_id, swarm = _create_support_swarm_and_register(broadcast, pid, pname)

    # Emit start so UI can subscribe
    swarm._emit("swarm:start", {
        "swarmId": swarm_id,
        "agents": [a.model_dump() for a in swarm.agents],
        "timestamp": int(__import__("time").time() * 1000),
    })

    def _run() -> None:
        if elevenlabs_ready:
            print(f"Triggering ElevenLabs outbound call for provider {pname}", flush=True)
            success, msg = initiate_outbound_call_to_provider(pid, slot_time)
            if success:
                print("ElevenLabs outbound call initiated; booking will be confirmed via webhook", flush=True)
            else:
                print(f"ElevenLabs outbound call failed: {msg}; using simulated fallback", flush=True)
                _emit_support_booking_completed(swarm, slot_time)
        else:
            print("Simulated booking fallback used", flush=True)
            _emit_support_booking_completed(swarm, slot_time)

    asyncio.create_task(asyncio.to_thread(_run))
    return swarm_id
