"""
CallPilot - Pydantic Models
"""
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class AgentStatus(str, Enum):
    IDLE = "idle"
    SEARCHING = "searching"
    CALLING = "calling"
    NEGOTIATING = "negotiating"
    BOOKED = "booked"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ProviderAgent(BaseModel):
    id: str
    name: str
    status: AgentStatus = AgentStatus.IDLE
    slotTime: Optional[str] = None
    elevenlabsReady: bool = False
    rating: Optional[float] = None  # Google Places-style 0-5
    distance_miles: Optional[float] = None  # For scoring / preference engine


class SearchRequest(BaseModel):
    service_type: str = "dentist"
    location: Optional[str] = "San Francisco, CA"
    max_distance: int = 10
    max_providers: int = 15  # Swarm: up to 15 providers
    preferred_date: Optional[str] = None
    preferences: Optional[dict] = None
    # User preference weighting (earliest_availability, rating, distance) — sum to 1.0
    preference_weights: Optional[dict] = None


class SearchResponse(BaseModel):
    swarm_id: str
    status: str = "spawning"
    message: str = "Calling providers in parallel"
    agents_spawned: int
    websocket_url: str


class AppointmentResult(BaseModel):
    swarm_id: str
    status: str
    total_results: int = 0
    best_result: Optional[dict] = None
    agents: list = Field(default_factory=list)
    # Ranked shortlist for confirmation (earliest availability, rating, distance, user weights)
    ranked_shortlist: list = Field(default_factory=list)
