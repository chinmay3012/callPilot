# CallPilot – Features, Resources & Evaluation

## 1. Implemented Features

### Multilingual Support
- **Automatic language detection** from user message (German, English, Turkish). Backend uses a simple word-overlap heuristic; for production consider `langdetect` or similar.
- **Seamless switching:** The Support Agent system prompt instructs the agent to respond in the user’s language and switch if they change (e.g. German → English).
- **Implementation:** `backend/language.py` (`detect_language`, `get_language_hint_for_prompt`). Webhook passes `detected_language` and `language_hint` in context and optionally in `tool_result` so the agent can adapt.

### Rescheduling & Cancellation Agent
- **Manage existing bookings:** Tools `list_my_appointments`, `reschedule_appointment`, `cancel_appointment`.
- **Flow:** User says “reschedule my dentist appointment” → agent calls `list_my_appointments` → identifies provider → `validate_slot` for new time → `reschedule_appointment(provider_name, new_slot_time)`. Cancel flow uses `cancel_appointment(provider_name)`.
- **Backend:** Appointments are stored in `backend/bookings_store.py` (persisted to `data/bookings_appointments.json`). Reschedule/cancel update the store. For **autonomous outbound call** to the provider to reschedule/cancel, extend `booking_orchestration.py` to trigger a “reschedule” or “cancel” call (same pattern as booking).

### Live User-in-the-Loop
- **Real-time transcript streaming:** Use the **ElevenLabs Conversational AI SDK** (WebSocket) on the client to receive live transcript. Backend does not receive transcript unless you forward it.
- **Backend support:**  
  - **WebSocket** `GET /api/support/ws/{session_id}` – connect with `session_id = conversation_id` from ElevenLabs. Backend emits: `support:human_handover`, `user_override`, and can relay `transcript:segment` if the client sends transcript events.
  - **User override:** `POST /api/support/session/{session_id}/override` with body `{"action": "cancel_booking" | "book_with" | "transfer" | "custom", "message": "..."}`. Stored per session; clients can poll `GET /api/support/session/{session_id}/overrides` to retrieve (and clear) overrides for the agent or UI.

### Hallucination-Aware Handover
- **Tool:** `request_human_handover` with `reason` and optional `confidence` (low/medium/high). Agent is instructed in the system prompt to prefer handover when uncertain or at risk of fabrication; **self-awareness over fluency**.
- **Backend:** When the tool is used, backend emits `support:human_handover` to the Support session WebSocket so the UI can show “Connecting you to a team member” or trigger a live transfer.

### Domain Expert Voice Agents
- **Routing:** `backend/domain_experts.py` – `suggest_domain_expert(user_input, service_type)` returns `health` | `fitness_therapy` | `general` and an optional prompt hint.
- **Usage:** Webhook attaches `suggested_expert` and `expert_prompt_hint` to `tool_result` when the user message or service type suggests health or fitness/therapy. The **main Support Agent** can use the hint in-conversation; for **separate expert agents** (e.g. Health Expert, Therapy Expert), the client or gateway can route by `suggested_expert` (e.g. switch to a different ElevenLabs agent ID).

### Waitlist & Callback Intelligence
- **Tool:** `register_waitlist(provider_name, preferred_times?, callback_phone?)` – adds the user to a waitlist stored in `data/bookings_waitlist.json`.
- **Retry logic:** `backend/waitlist_retry.py` – `check_waitlist_and_notify(broadcast_support)`. Demo uses a mock “slots available” check; in production plug in provider API or calendar checks. Run periodically (cron or scheduler).
- **Endpoint:** `POST /support-agent/waitlist-check` – runs the check and notifies pending entries; optionally call from a cron job.

---

## 2. Hints and Resources

### ElevenLabs (Core)
- **Conversational AI SDK** – WebSocket voice interaction; use for real-time transcript and low-latency responses.
- **Agentic Functions (Tool Calling)** – Configure tools in the dashboard; webhook URL: `https://your-domain.com/support-agent/webhook`.
- **Voice Library / Professional Voice Cloning** – For consistent brand voice across Support and booking agents.

### Backend & Orchestration
- **Python (FastAPI)** – This repo; add routes under `backend/main.py` and `support_webhook_handler.py`.
- **Twilio or SIP** – For outbound calls (booking, reschedule, cancel, callback). Integrate in `backend/live_call.py` or a dedicated outbound module.

### External APIs
- **Google Calendar API** – User free/busy and double-book checks (`backend/calendar_service.py`).
- **Google Places API** – Enrich provider data (address, hours).
- **Google Maps Distance Matrix API** – Real distance/duration for scoring (`backend/scoring.py`, `preference_engine.py`).

### Data Simulation
- **Provider directory:** `data/mock_providers.json` (dentists), `data/support_services.json` (doctor, vet, plumber, salon, auto_repair, therapist). Add entries for a full workflow demo.
- **Simulated receptionist:** Booking flow can use simulated booking (no live call) when `elevenlabsReady` is false; events `agent:booked` and `swarm:completed` are still emitted for the UI.

---

## 3. Evaluation Criteria

| Criterion | What to measure |
|----------|------------------|
| **Conversational quality** | Natural interaction, interruption handling, &lt;1s latency (voice + tool round-trip). |
| **Use of agentic functions** | Correct tool choice and order (e.g. find_provider → query_calendar → validate_slot → schedule_appointment); no hallucinated providers. |
| **Optimal match quality** | Final recommendation fits user constraints (distance, rating, availability). |
| **Parallelization & scalability** | Swarm handles concurrent provider calls; webhook and store handle concurrent tool calls without race conditions. |
| **User experience** | Seamless journey from request → booked appointment (or reschedule/cancel/waitlist); clear handover when agent defers to human. |

---

## 4. New Support Agent Tools (Summary)

Add these in ElevenLabs as Custom Tools with the same webhook URL. Schemas are in `backend/support_agent_config.py` → `SUPPORT_AGENT_TOOLS`.

| Tool | Purpose |
|------|--------|
| `list_my_appointments` | List user’s appointments (for reschedule/cancel flows). |
| `reschedule_appointment` | Reschedule by provider name and new_slot_time (calendar checked). |
| `cancel_appointment` | Cancel by provider name. |
| `request_human_handover` | Transfer to human when uncertain; backend emits handover event. |
| `register_waitlist` | Add user to provider waitlist; backend runs retry logic on demand or cron. |

Update the Support Agent system prompt in the dashboard to include the new tools and the multilingual + self-awareness instructions (see `SUPPORT_AGENT_PERSONA.system_prompt` in `support_agent_config.py`).
