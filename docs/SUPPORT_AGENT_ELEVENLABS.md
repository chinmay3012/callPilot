# Support Agent – Setup in ElevenLabs

This guide helps you create a **Support Agent** in ElevenLabs for daily-life tasks: Find Doctor, Find Dentist, Find Vet, Plumber, Salon, Auto repair, etc.—the kind of tasks that are still under-served by most startups.

## Troubleshooting: 404 Not Found

If ElevenLabs returns **404 Not Found** when calling your webhook:

1. **Restart your backend** so it loads the Support agent routes (this repo must include `backend/support_webhook_handler.py` and `app.include_router(support_webhook_router)` in `backend/main.py`).
2. **Check the route is live:** open in a browser or run:
   ```bash
   curl https://YOUR_NGROK_OR_DOMAIN/support-agent
   ```
   You should get `{"status":"ok","agent":"CallPilot Support Agent","webhook":"POST /support-agent/webhook"}`. If you get 404, the server running behind the URL is not this backend or hasn’t been restarted after adding the Support agent.
3. **Webhook URL must be exactly:** `https://YOUR_HOST/support-agent/webhook` (no trailing slash, no extra path like `/api` unless your app is mounted under `/api`).

## What the Support Agent Does

- **Find providers** by type: doctor, dentist, vet, plumber, salon, auto_repair, therapist, home_cleaning, fitness
- **Check your calendar** so suggested times don’t double-book
- **Get provider details** (rating, distance)
- **Check availability** and suggest slots
- **Validate a time** against your calendar before booking
- **Schedule an appointment** and return a confirmation message
- **List, reschedule, or cancel** existing appointments (list_my_appointments, reschedule_appointment, cancel_appointment)

The Support Agent runs **10 real-world tasks** end-to-end; see **demo/README.md** and **demo/TASKS.md** for the full list and example prompts.

The agent asks clarifying questions when something is unclear and adapts to the task (e.g. empathetic for health, efficient for repairs).

## 1. Create the Agent in ElevenLabs

1. In [ElevenLabs](https://elevenlabs.io) go to **Conversational AI** → **Create new agent**.
2. Name it e.g. **"CallPilot Support"** or **"Daily Life Assistant"**.

## 2. System Prompt

**Important:** The prompt instructs the agent to always include `slot_time` when calling schedule_appointment (using the time the user said). Refresh this in ElevenLabs if you update the backend.

In **Agent → Prompt → System prompt**, paste the contents of:

- **Backend:** `backend/support_agent_config.py` → `SUPPORT_AGENT_PERSONA.system_prompt`  
- Or call **GET** `https://your-api.com/support-agent/config` and copy `system_prompt` from the JSON.

The prompt tells the agent to use tools for find_provider, query_calendar, get_provider_details, check_availability, validate_slot, and schedule_appointment, and to ask clarifying questions when needed.

## 3. Add Tools (Custom Tools)

In **Agent → Tools**, add one **Custom Tool** per tool below. For each tool:

- **Name:** exactly as in the table (e.g. `find_provider`).
- **Description:** copy from the table.
- **Parameters:** use the JSON schema from the table (or from `SUPPORT_AGENT_TOOLS` in `support_agent_config.py`).
- **Webhook:**  
  - **URL:** `https://your-domain.com/support-agent/webhook`  
  - **Method:** POST  
  - Request body will be like: `{ "tool_name": "<name>", "arguments": { ... } }`.

| Tool name           | Description (short) |
|--------------------|---------------------|
| `find_provider`    | Search by service_type (doctor, dentist, vet, plumber, salon, auto_repair, therapist), optional location, max_distance_miles, min_rating. |
| `query_calendar`   | Get user’s free windows for a date (for_date: today/tomorrow/YYYY-MM-DD). |
| `get_provider_details` | Get one provider’s rating, distance, specialty. |
| `check_availability`   | Get a provider’s available slots or next available time. |
| `validate_slot`    | Check if a proposed time is free on the user’s calendar and valid (no double booking). |
| `schedule_appointment` | Confirm and schedule; returns a confirmation message. (If you created the tool as `book_appointment` in ElevenLabs, the webhook accepts that too.) |
| `list_my_appointments` | List the user’s existing appointments (for reschedule/cancel). |
| `reschedule_appointment` | Reschedule an appointment to a new time (provider_name, new_slot_time). |
| `cancel_appointment` | Cancel an appointment by provider name. |
| `request_human_handover` | Transfer to a human when uncertain; use for self-awareness over fluency. |
| `register_waitlist` | Add user to a provider’s waitlist for callback when slots open. |

Exact parameter schemas are in `backend/support_agent_config.py` → `SUPPORT_AGENT_TOOLS`. See **docs/FEATURES_AND_RESOURCES.md** for multilingual, handover, domain experts, waitlist retry, and evaluation criteria.

## 4. Webhook URL

- **Full URL:** `https://your-domain.com/support-agent/webhook`
- Use your deployed backend URL (or ngrok for local testing).
- Ensure this route is reachable from the internet so ElevenLabs can POST tool calls.

## 5. Voice and Model

- Choose a **voice** (e.g. same as your scheduling agent).
- **Model:** e.g. `eleven_turbo_v2_5` for low latency.

## 6. Test

- Start a conversation with the Support agent.
- Say e.g. “I need to find a doctor” or “Find me a dentist near me” or “I need a plumber.”
- The agent should call `find_provider`, then optionally `query_calendar`, `check_availability`, `validate_slot`, and finally `schedule_appointment` when the user agrees to a time.

## Backend Reference

- **Config:** `backend/support_agent_config.py` – persona and tool definitions.
- **Tool logic:** `backend/support_agent_tools.py` – implements each tool (uses `data/support_services.json` and existing calendar/provider services).
- **Webhook:** `backend/support_webhook_handler.py` – POST `/support-agent/webhook` runs the tool and returns `{ "status": "success", "tool_result": { ... } }`.
- **Optional:** GET `/support-agent/config` returns system prompt and tool names for copy-paste into ElevenLabs.

## schedule_appointment tool (ElevenLabs envelope format)

If your tool sends a body like `{ "tool_name": "schedule_appointment", "input": { ... } }`, the backend accepts it and uses `input` as the arguments. **Include `slot_time`** in the `input` object so the agent can book a specific time. A ready-to-use JSON for the ElevenLabs UI is in:

- **`docs/elevenlabs-schedule_appointment-tool.json`**

Replace the `api_schema.url` with your own webhook URL (e.g. your ngrok or production host), then paste or import the tool in the agent.

## Adding More Service Types

Edit `data/support_services.json`: add a key (e.g. `"electrician"`) and a list of providers with `id`, `name`, `rating`, `distanceMiles`. The Support agent’s `find_provider` will return them when the user asks for that type.
