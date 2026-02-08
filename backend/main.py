"""
CallPilot - FastAPI Backend
API + WebSocket for swarm orchestration
"""
import asyncio
import json
from typing import Dict, Set

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS, DEMO_MODE
from .models import SearchRequest, SearchResponse, AppointmentResult, AgentStatus
from .swarm import SwarmOrchestrator, get_swarm
from .webhook_handler import router as webhook_router
from .support_webhook_handler import router as support_webhook_router
from .live_call import initiate_outbound_call

app = FastAPI(title="CallPilot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook_router)
app.include_router(support_webhook_router)

# WebSocket connections per swarm
_ws_connections: Dict[str, Set[WebSocket]] = {}
# Support agent session (conversation_id) → WebSockets for live transcript / handover / override
_support_ws_connections: Dict[str, Set[WebSocket]] = {}
# User-in-the-loop overrides per session (session_id → list of {action, message, ts})
_user_overrides: Dict[str, list] = {}


def _broadcast(swarm_id: str, event: str, payload: dict) -> None:
    """Send event to all WebSocket clients subscribed to this swarm"""
    conns = _ws_connections.get(swarm_id)
    if not conns:
        return
    msg = json.dumps({"event": event, "data": payload})
    for ws in list(conns):
        try:
            asyncio.create_task(ws.send_text(msg))
        except Exception:
            pass


def _broadcast_support(session_id: str, event: str, payload: dict) -> None:
    """Send event to all WebSocket clients subscribed to this Support agent session (live transcript, handover)."""
    conns = _support_ws_connections.get(session_id)
    if not conns:
        return
    msg = json.dumps({"event": event, "data": payload})
    for ws in list(conns):
        try:
            asyncio.create_task(ws.send_text(msg))
        except Exception:
            pass


# For booking orchestration (Support Agent schedule_appointment → live call or simulated)
app.state.broadcast = _broadcast
app.state.broadcast_support = _broadcast_support
app.state.user_overrides = _user_overrides


@app.get("/")
async def root():
    return {"name": "CallPilot API", "demo_mode": DEMO_MODE}


@app.get("/start-live-call/status")
async def start_live_call_status():
    """Diagnostic: returns whether ElevenLabs env is configured (no secrets)."""
    from .config import (
        ELEVENLABS_API_KEY,
        ELEVENLABS_AGENT_ID,
        ELEVENLABS_PHONE_NUMBER_ID,
        ELEVENLABS_OUTBOUND_TO_NUMBER,
    )
    return {
        "elevenlabs_configured": bool(
            ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID
            and ELEVENLABS_PHONE_NUMBER_ID and ELEVENLABS_OUTBOUND_TO_NUMBER
        ),
    }


@app.post("/start-live-call")
async def start_live_call():
    """
    CTA-triggered endpoint. Initiates ElevenLabs outbound call.
    Returns 200 immediately. Does not block.
    """
    print("CTA clicked — starting ElevenLabs outbound call", flush=True)

    def _do_call():
        try:
            success, msg = initiate_outbound_call()
            if success:
                print("ElevenLabs outbound call initiated", flush=True)
            else:
                print(f"ElevenLabs outbound call failed: {msg}", flush=True)
        except Exception as e:
            print(f"ElevenLabs outbound call error: {e}", flush=True)

    asyncio.create_task(asyncio.to_thread(_do_call))

    return {"status": "accepted", "message": "Live call request queued"}


@app.post("/api/appointments/search", response_model=SearchResponse)
async def search_appointments(req: SearchRequest, request: Request):
    """Start a swarm search - spawns parallel agents (up to 15)."""
    max_providers = min(max(1, req.max_providers), 15)

    def broadcast(event: str, payload: dict):
        _broadcast(swarm_id, event, payload)

    swarm = SwarmOrchestrator(broadcast=broadcast)
    swarm_id = swarm.swarm_id

    # Run swarm in background with user preference weights for scoring
    asyncio.create_task(swarm.run(
        max_providers=max_providers,
        preference_weights=req.preference_weights,
    ))

    # Derive WebSocket URL from request host
    if request:
        host = request.url.hostname or "localhost"
        port = request.url.port or 8000
        scheme = "wss" if request.url.scheme == "https" else "ws"
        base = f"{scheme}://{host}:{port}" if port not in (80, 443) else f"{scheme}://{host}"
    else:
        base = "ws://localhost:8000"
    return SearchResponse(
        swarm_id=swarm_id,
        status="spawning",
        message=f"Calling {max_providers} providers in parallel",
        agents_spawned=max_providers,
        websocket_url=f"{base}/api/appointments/ws/{swarm_id}",
    )


@app.get("/api/appointments/results/{swarm_id}", response_model=AppointmentResult)
async def get_results(swarm_id: str):
    """Get ranked appointment results for a swarm"""
    swarm = get_swarm(swarm_id)
    if not swarm:
        return AppointmentResult(
            swarm_id=swarm_id,
            status="unknown",
            total_results=0,
            agents=[],
        )

    booked = [a for a in swarm.agents if a.status == AgentStatus.BOOKED and a.slotTime]
    best = None
    if swarm.winner:
        best = {
            "provider": {"name": swarm.winner.name},
            "time_slot": {"datetime": swarm.winner.slotTime, "duration_minutes": 30},
            "score": 0.89,
            "rank": 1,
        }

    return AppointmentResult(
        swarm_id=swarm_id,
        status="completed" if swarm.completed else "running",
        total_results=len(booked),
        best_result=best,
        agents=[a.model_dump() for a in swarm.agents],
        ranked_shortlist=swarm.ranked_shortlist,
    )


@app.websocket("/api/appointments/ws/{swarm_id}")
async def websocket_endpoint(websocket: WebSocket, swarm_id: str):
    """Real-time updates for a swarm"""
    await websocket.accept()

    if swarm_id not in _ws_connections:
        _ws_connections[swarm_id] = set()
    _ws_connections[swarm_id].add(websocket)

    # Send current state if swarm exists and has started
    swarm = get_swarm(swarm_id)
    if swarm and swarm.agents:
        await websocket.send_text(json.dumps({
            "event": "swarm:start",
            "data": {
                "swarmId": swarm_id,
                "agents": [a.model_dump() for a in swarm.agents],
                "timestamp": int(__import__("time").time() * 1000),
            },
        }))
        if swarm.completed:
            await websocket.send_text(json.dumps({
                "event": "swarm:completed",
                "data": {
                    "swarmId": swarm_id,
                    "winnerId": swarm.winner.id if swarm.winner else None,
                    "winnerName": swarm.winner.name if swarm.winner else None,
                    "winnerSlot": swarm.winner.slotTime if swarm.winner else None,
                    "allAgents": [a.model_dump() for a in swarm.agents],
                },
            }))

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _ws_connections.get(swarm_id, set()).discard(websocket)
        if not _ws_connections.get(swarm_id):
            _ws_connections.pop(swarm_id, None)


# --- Support Agent: live user-in-the-loop (transcript streaming, handover, override) ---

@app.websocket("/api/support/ws/{session_id}")
async def support_websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    Real-time updates for a Support agent session: transcript segments (if sent by client),
    human handover events, booking initiated. Connect with session_id = conversation_id from ElevenLabs.
    """
    await websocket.accept()
    if session_id not in _support_ws_connections:
        _support_ws_connections[session_id] = set()
    _support_ws_connections[session_id].add(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            # Optional: client can send transcript segments to broadcast to other clients
            try:
                data = json.loads(raw)
                if data.get("type") == "transcript" and data.get("text"):
                    _broadcast_support(session_id, "transcript:segment", {"text": data["text"], "role": data.get("role", "user")})
            except Exception:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        _support_ws_connections.get(session_id, set()).discard(websocket)
        if not _support_ws_connections.get(session_id):
            _support_ws_connections.pop(session_id, None)


@app.post("/api/support/session/{session_id}/override")
async def support_session_override(session_id: str, request: Request):
    """
    User-in-the-loop: submit an override (e.g. cancel booking, book with X instead).
    Body: { "action": "cancel_booking" | "book_with" | "transfer" | "custom", "message": "..." }.
    Stored for the session; agent or next request can use it.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}
    action = body.get("action", "custom")
    message = body.get("message", "")
    if session_id not in _user_overrides:
        _user_overrides[session_id] = []
    _user_overrides[session_id].append({"action": action, "message": message, "ts": __import__("time").time()})
    # Keep last 10
    _user_overrides[session_id] = _user_overrides[session_id][-10:]
    _broadcast_support(session_id, "user_override", {"action": action, "message": message})
    return {"status": "ok", "session_id": session_id, "action": action}


@app.get("/api/support/session/{session_id}/overrides")
async def get_support_overrides(session_id: str):
    """Return and clear pending overrides for this session (e.g. for agent to poll)."""
    overrides = _user_overrides.get(session_id, [])
    _user_overrides[session_id] = []
    return {"overrides": overrides}


if __name__ == "__main__":
    import uvicorn
    from .config import API_HOST, API_PORT

    uvicorn.run("backend.main:app", host=API_HOST, port=API_PORT, reload=True)
