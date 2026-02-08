# CallPilot

> **Agentic Voice AI Appointment Booking** — Autonomous, parallel appointment booking powered by ElevenLabs Conversational AI

[![GitHub](https://img.shields.io/badge/GitHub-callPilot-181717?logo=github)](https://github.com/chinmay3012/callPilot) [![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-black?logo=vercel)](https://callpilotai.vercel.app/)

**Live Demo:** [https://callpilotai.vercel.app/](https://callpilotai.vercel.app/)

Built for MIT Hacknation Hackathon 2026

---

## What is CallPilot?

CallPilot is an AI agent that **actually makes phone calls** to multiple service providers simultaneously, negotiates appointment times, and intelligently selects the best option based on earliest availability, provider rating, distance, and your calendar.

### Demo Mode (No API Keys)

- 5 AI agents simulate parallel calls
- Real-time status updates via WebSocket
- Earliest valid slot (≥ 9:30 AM) selected automatically

### Production Mode

- Real ElevenLabs voice agents
- Twilio outbound calls
- Webhook at `/call-status` receives tool calls

---

## Quick Start

### 1. Install Dependencies

```bash
# Python backend
pip install -r requirements.txt

# Frontend
npm install
```

### 2. Run the System

**Terminal 1 — Python backend:**
```bash
python -m backend.main
# Server: http://localhost:8000
```

**Terminal 2 — React frontend:**
```bash
npm run dev
# App: http://localhost:8080
```

### 3. Use the App

1. Open http://localhost:8080
2. Click **Find Dentist Appointment**
3. Watch 5 agents negotiate slots in parallel
4. Best appointment appears when complete

### Support Agent & 10-Task Demo

The **Support Agent** runs **10+ real-world tasks** end-to-end (find → decide → act) via the same tool-calling architecture: find & book doctor, dentist, vet, therapist, salon, auto repair, plumber, home cleaning, fitness class, and reschedule/cancel. Works via **text** and **voice** (ElevenLabs). See **[demo/](demo/)** for:

- **[demo/README.md](demo/README.md)** — Overview for users, investors, and judges
- **[demo/TASKS.md](demo/TASKS.md)** — All 10 tasks with sample inputs and tool flows
- **[demo/QUICK_START.md](demo/QUICK_START.md)** — Run backend + ElevenLabs webhook
- **[demo/example_prompts.txt](demo/example_prompts.txt)** — Copy-paste prompts for demos

---

## Architecture

```
React Frontend (8080)
       │
       │ POST /api/appointments/search
       │ WebSocket /api/appointments/ws/{swarm_id}
       ▼
Python FastAPI (8000)
       │
       ├── Swarm Orchestrator (parallel agents)
       ├── Demo: simulated calls
       ├── Production: ElevenLabs + Twilio
       └── Webhook: POST /call-status
```

---

## Project Structure

```
├── backend/           # Python FastAPI
│   ├── main.py        # API + WebSocket
│   ├── swarm.py       # Orchestrator
│   ├── models.py      # Pydantic models
│   ├── config.py      # Settings
│   ├── provider_service.py
│   ├── scoring.py
│   ├── voice_agent.py
│   ├── elevenlabs_config.py
│   └── webhook_handler.py
├── data/
│   └── mock_providers.json
├── src/               # React frontend
│   ├── backend/       # TypeScript (in-browser fallback)
│   ├── hooks/useSwarmController.ts
│   └── pages/Index.tsx
├── requirements.txt
└── .env.example
```

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/appointments/search` | Start swarm search |
| GET | `/api/appointments/results/{swarm_id}` | Get results |
| WS | `/api/appointments/ws/{swarm_id}` | Real-time updates |
| POST | `/call-status` | ElevenLabs webhook |
| GET | `/call-status/health` | Webhook health |

---

## Environment

Copy `.env.example` to `.env`:

```env
DEMO_MODE=true   # No API keys needed
API_PORT=8000
```

For production, set `DEMO_MODE=false` and add ElevenLabs + Twilio keys.

---

## Fallback Mode

If the Python backend is not running, the frontend falls back to **in-browser simulation** using the TypeScript `SwarmOrchestrator`. The UI works identically.
