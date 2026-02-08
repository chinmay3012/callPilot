"""
CallPilot - Swarm Orchestrator
Runs parallel voice agents (up to 15), handles webhook results, emits WebSocket events.
Aggregates results using scoring: earliest availability, Google rating, distance, user weights.
Returns ranked shortlist for confirmation.
Demo: uses receptionist_simulation.json for per-provider slots when available.
"""
import asyncio
import json
import random
import uuid
from typing import Callable, Dict, List, Optional

from .config import DATA_DIR, DEMO_MODE
from .models import ProviderAgent, AgentStatus
from .provider_service import load_providers, to_provider_agents
from .scoring import parse_time, rank_booked_agents, rank_booked_agents_scored

# Global registry for webhook lookup
_swarms: dict[str, "SwarmOrchestrator"] = {}
_agent_to_swarm: dict[str, str] = {}


def get_swarm(swarm_id: str) -> Optional["SwarmOrchestrator"]:
    """Get swarm by ID (for webhook handler)"""
    return _swarms.get(swarm_id)


def get_swarm_by_agent(agent_id: str) -> Optional["SwarmOrchestrator"]:
    """Get swarm by agent ID (for webhook handler)"""
    sid = _agent_to_swarm.get(agent_id)
    return _swarms.get(sid) if sid else None


MOCK_SLOTS = [
    "8:00 AM", "8:30 AM", "9:00 AM", "9:15 AM", "9:30 AM",
    "10:00 AM", "10:30 AM", "11:00 AM", "11:45 AM",
    "1:00 PM", "2:15 PM", "3:00 PM", "4:30 PM",
]
MIN_VALID_TIME = "9:30 AM"


def _load_receptionist_slots_by_provider() -> Dict[str, List[str]]:
    """Load per-provider slots from receptionist_simulation.json for demo."""
    path = DATA_DIR / "receptionist_simulation.json"
    if not path.exists():
        return {}
    try:
        with open(path) as f:
            data = json.load(f)
        by_id = data.get("byProviderId") or {}
        return {
            pid: info.get("slots", MOCK_SLOTS)
            for pid, info in by_id.items()
            if info.get("slots")
        }
    except Exception:
        return {}


class SwarmOrchestrator:
    def __init__(self, broadcast: Callable[[str, dict], None]):
        self.swarm_id = f"swarm-{uuid.uuid4().hex[:12]}"
        self.broadcast = broadcast  # (event, payload) -> None
        self.agents: list[ProviderAgent] = []
        self.winner: Optional[ProviderAgent] = None
        self.ranked_shortlist: list[dict] = []  # Ranked shortlist for confirmation
        self.completed = False
        self.completed_count = 0
        self._provider_metadata: dict = {}  # id -> {rating, distanceMiles} for scoring
        self._preference_weights: Optional[dict] = None

    async def run(
        self,
        max_providers: int = 15,
        service_type: str = "dentist",
        preference_weights: Optional[dict] = None,
    ) -> list[ProviderAgent]:
        """Execute swarm - parallel agents (up to 15), demo or real calls."""
        max_providers = min(max(1, max_providers), 15)
        raw = load_providers(service_type=service_type, max_count=max_providers)
        self.agents = to_provider_agents(raw)
        self._preference_weights = preference_weights
        self._provider_metadata = {
            p["id"]: {"rating": p.get("rating"), "distanceMiles": p.get("distanceMiles")}
            for p in raw
        }

        # Register for webhook lookup
        _swarms[self.swarm_id] = self
        for a in self.agents:
            _agent_to_swarm[a.id] = self.swarm_id

        # Emit start
        self._emit("swarm:start", {
            "swarmId": self.swarm_id,
            "agents": [_a.model_dump() for _a in self.agents],
            "timestamp": _now(),
        })

        if DEMO_MODE:
            await self._run_demo()
        else:
            await self._run_production()

        return self.agents

    async def _run_demo(self) -> None:
        """Demo: simulate receptionist agents with per-provider slots from receptionist_simulation.json."""
        min_time = parse_time(MIN_VALID_TIME)
        receptionist_slots = _load_receptionist_slots_by_provider()
        tasks = []

        for agent in self.agents:
            agent_slots = receptionist_slots.get(agent.id) or MOCK_SLOTS
            async def run_agent(a: ProviderAgent, slots: List[str]):
                delay = 1.0 + random.random() * 4.0
                slot = random.choice(slots)
                is_valid = parse_time(slot) >= min_time

                await asyncio.sleep(delay * 0.3)
                if self.completed:
                    return
                self._update_agent(a.id, AgentStatus.CALLING, None)
                self._emit("swarm:update", {
                    "swarmId": self.swarm_id, "agentId": a.id,
                    "status": "calling", "slotTime": None,
                    "message": f"📞 {a.name}: Dialing provider...",
                })

                await asyncio.sleep(delay * 0.35)
                if self.completed:
                    return
                self._update_agent(a.id, AgentStatus.NEGOTIATING, slot)
                self._emit("swarm:update", {
                    "swarmId": self.swarm_id, "agentId": a.id,
                    "status": "negotiating", "slotTime": slot,
                    "message": f"🤝 {a.name}: Negotiating — offered {slot}",
                })

                await asyncio.sleep(delay * 0.35)
                if self.completed:
                    self._update_agent(a.id, AgentStatus.CANCELLED, slot)
                    self._emit("swarm:update", {
                        "swarmId": self.swarm_id, "agentId": a.id,
                        "status": "cancelled", "slotTime": slot,
                        "message": f"⏹️ {a.name}: Cancelled (winner already selected)",
                    })
                elif is_valid:
                    self._update_agent(a.id, AgentStatus.BOOKED, slot)
                    self._emit("swarm:update", {
                        "swarmId": self.swarm_id, "agentId": a.id,
                        "status": "booked", "slotTime": slot,
                        "message": f"✅ {a.name}: Slot {slot} accepted",
                    })
                else:
                    self._update_agent(a.id, AgentStatus.REJECTED, slot)
                    self._emit("swarm:update", {
                        "swarmId": self.swarm_id, "agentId": a.id,
                        "status": "rejected", "slotTime": slot,
                        "message": f"❌ {a.name}: Slot {slot} rejected (before 9:30 AM)",
                    })

                self.completed_count += 1
                await self._evaluate_complete()

            tasks.append(asyncio.create_task(run_agent(agent, agent_slots)))

        await asyncio.gather(*tasks)

    async def _run_production(self) -> None:
        """Production: initiate real ElevenLabs calls; results via webhook"""
        # For now, fall back to demo - full ElevenLabs integration needs SDK
        await self._run_demo()

    def process_webhook_result(
        self,
        agent_id: str,
        call_status: str,
        offered_slot: Optional[str],
        booking_confirmed: bool,
        tool_calls: list,
    ) -> None:
        """Process webhook from ElevenLabs (tool call / call ended)"""
        agent = next((a for a in self.agents if a.id == agent_id), None)
        if not agent:
            return

        if call_status in ("failed", "no_answer"):
            self._update_agent(agent_id, AgentStatus.REJECTED, None)
            self._emit("swarm:update", {
                "swarmId": self.swarm_id, "agentId": agent_id,
                "status": "rejected", "slotTime": None,
                "message": f"❌ {agent.name}: Call {call_status}",
            })
            self.completed_count += 1
            asyncio.create_task(self._evaluate_complete())
            return

        tool = next((t for t in tool_calls if t.get("tool_name") == "book_appointment"), None)
        if not tool:
            self._update_agent(agent_id, AgentStatus.REJECTED, offered_slot)
            self._emit("swarm:update", {
                "swarmId": self.swarm_id, "agentId": agent_id,
                "status": "rejected", "slotTime": offered_slot,
                "message": f"❌ {agent.name}: No valid slot offered",
            })
            self.completed_count += 1
            asyncio.create_task(self._evaluate_complete())
            return

        params = tool.get("parameters", {})
        slot_time = params.get("slot_time") or offered_slot
        min_time = parse_time(MIN_VALID_TIME)
        is_valid = slot_time and parse_time(slot_time) >= min_time

        if self.completed:
            self._update_agent(agent_id, AgentStatus.CANCELLED, slot_time)
            self._emit("swarm:update", {
                "swarmId": self.swarm_id, "agentId": agent_id,
                "status": "cancelled", "slotTime": slot_time,
                "message": f"⏹️ {agent.name}: Cancelled (winner already selected)",
            })
        elif is_valid and booking_confirmed:
            self._update_agent(agent_id, AgentStatus.BOOKED, slot_time)
            self._emit("swarm:update", {
                "swarmId": self.swarm_id, "agentId": agent_id,
                "status": "booked", "slotTime": slot_time,
                "message": f"🤖 ElevenLabs agent confirmed booking at {slot_time}",
                "fromLiveCall": True,
            })
        else:
            self._update_agent(agent_id, AgentStatus.REJECTED, slot_time)
            self._emit("swarm:update", {
                "swarmId": self.swarm_id, "agentId": agent_id,
                "status": "rejected", "slotTime": slot_time,
                "message": f"❌ {agent.name}: Slot rejected",
            })

        self.completed_count += 1
        asyncio.create_task(self._evaluate_complete())

    async def _evaluate_complete(self) -> None:
        if self.completed_count < len(self.agents) or self.completed:
            return
        self.completed = True

        # Build ranked shortlist: earliest availability, Google rating, distance, user weights
        weights = self._preference_weights or {}
        time_w = weights.get("earliest_availability", 0.5)
        rating_w = weights.get("rating", 0.3)
        distance_w = weights.get("distance", 0.2)
        scored = rank_booked_agents_scored(
            self.agents,
            time_weight=time_w,
            rating_weight=rating_w,
            distance_weight=distance_w,
            provider_metadata=self._provider_metadata,
        )
        self.ranked_shortlist = [
            {
                "rank": i + 1,
                "agentId": a.id,
                "providerName": a.name,
                "slotTime": a.slotTime,
                "score": round(s, 4),
                "rating": getattr(a, "rating") or self._provider_metadata.get(a.id, {}).get("rating"),
                "distanceMiles": getattr(a, "distance_miles") or self._provider_metadata.get(a.id, {}).get("distanceMiles"),
            }
            for i, (a, s) in enumerate(scored)
        ]

        winner = rank_booked_agents(self.agents)  # Single best (earliest) for backward compat
        if winner:
            for a in self.agents:
                if a.id != winner.id and a.status == AgentStatus.BOOKED:
                    self._update_agent(a.id, AgentStatus.CANCELLED, a.slotTime)
                    self._emit("swarm:update", {
                        "swarmId": self.swarm_id, "agentId": a.id,
                        "status": "cancelled", "slotTime": a.slotTime,
                        "message": f"⏹️ {a.name}: Cancelled (not earliest slot)",
                    })
            self.winner = winner
            self._emit("agent:booked", {
                "swarmId": self.swarm_id, "agentId": winner.id,
                "providerName": winner.name, "slotTime": winner.slotTime or "",
            })

        self._emit("swarm:completed", {
            "swarmId": self.swarm_id,
            "winnerId": self.winner.id if self.winner else None,
            "winnerName": self.winner.name if self.winner else None,
            "winnerSlot": self.winner.slotTime if self.winner else None,
            "allAgents": [a.model_dump() for a in self.agents],
            "rankedShortlist": self.ranked_shortlist,
        })

        self._cleanup_registry()

    def _update_agent(self, agent_id: str, status: AgentStatus, slot_time: Optional[str]) -> None:
        for a in self.agents:
            if a.id == agent_id:
                a.status = status
                a.slotTime = slot_time or a.slotTime
                break

    def _emit(self, event: str, payload: dict) -> None:
        self.broadcast(event, payload)

    def _cleanup_registry(self) -> None:
        for a in self.agents:
            _agent_to_swarm.pop(a.id, None)
        _swarms.pop(self.swarm_id, None)


def _now() -> int:
    import time
    return int(time.time() * 1000)
