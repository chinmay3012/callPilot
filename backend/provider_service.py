"""
CallPilot - Provider Management
Loads providers from provider_directory.json (all service types) or mock_providers.json (dentists) for demo.
"""
import json
from pathlib import Path
from typing import List

from .config import DATA_DIR
from .models import ProviderAgent, AgentStatus


def load_providers(service_type: str = "dentist", max_count: int = 5) -> List[dict]:
    """Load providers by service_type from provider_directory.json or mock_providers.json (dentists)."""
    # Try provider_directory first (doctor, vet, plumber, salon, auto_repair, therapist, dentist)
    path = DATA_DIR / "provider_directory.json"
    if path.exists():
        try:
            with open(path) as f:
                data = json.load(f)
            all_providers = data.get("providers", []) if isinstance(data, dict) else []
            st = _normalize_service_type_for_load(service_type)
            filtered = [p for p in all_providers if (p.get("service_type") or "dentist").lower() == st]
            if filtered:
                return filtered[:max_count]
        except Exception:
            pass

    # Fallback: mock_providers (dentists only)
    path = DATA_DIR / "mock_providers.json"
    if path.exists():
        try:
            with open(path) as f:
                data = json.load(f)
            providers = data if isinstance(data, list) else data.get("providers", [])
            return providers[:max_count]
        except Exception:
            pass

    return _default_providers()[:max_count]


def _normalize_service_type_for_load(raw: str) -> str:
    """Map UI/service names to provider_directory service_type."""
    if not raw or not isinstance(raw, str):
        return "dentist"
    s = raw.strip().lower()
    mapping = {
        "doctor": "doctor",
        "dentist": "dentist",
        "vet": "vet",
        "plumber": "plumber",
        "salon": "salon",
        "haircut": "salon",
        "hair": "salon",
        "auto": "auto_repair",
        "auto_repair": "auto_repair",
        "car": "auto_repair",
        "therapist": "therapist",
    }
    return mapping.get(s, s)


def _default_providers() -> List[dict]:
    """Fallback when mock file missing"""
    return [
        {"id": "agent-1", "name": "Dentist A", "elevenlabsReady": True},
        {"id": "agent-2", "name": "Dentist B", "elevenlabsReady": False},
        {"id": "agent-3", "name": "Dentist C", "elevenlabsReady": False},
        {"id": "agent-4", "name": "Dentist D", "elevenlabsReady": False},
        {"id": "agent-5", "name": "Dentist E", "elevenlabsReady": False},
    ]


def to_provider_agents(providers: List[dict]) -> List[ProviderAgent]:
    """Convert raw provider dicts to ProviderAgent models (with rating, distance for scoring)."""
    return [
        ProviderAgent(
            id=p["id"],
            name=p.get("name", p["id"]),
            status=AgentStatus.SEARCHING,
            slotTime=None,
            elevenlabsReady=p.get("elevenlabsReady", False),
            rating=p.get("rating"),
            distance_miles=p.get("distanceMiles"),
        )
        for p in providers
    ]
