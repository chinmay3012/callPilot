# Demo Quick Start

Minimal steps to run the Support Agent demo so you can try the 10 tasks via **text** or **voice** (ElevenLabs).

## 1. Backend

From the project root:

```bash
# Optional: use a virtualenv
python3 -m venv venv
source venv/bin/activate   # or: venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run the backend (default port 8000)
cd backend && uvicorn main:app --reload --host 0.0.0.0
```

Confirm: open **http://localhost:8000/support-agent** — you should see:

```json
{"status":"ok","agent":"CallPilot Support Agent","webhook":"POST /support-agent/webhook"}
```

## 2. Expose the backend (for ElevenLabs voice)

ElevenLabs must reach your webhook over HTTPS. For local demos, use **ngrok**:

```bash
ngrok http 8000
```

Copy the HTTPS URL (e.g. `https://abc123.ngrok.io`). Your webhook URL will be:

**`https://YOUR_NGROK_HOST/support-agent/webhook`**

## 3. ElevenLabs Support Agent

1. In [ElevenLabs](https://elevenlabs.io) go to **Conversational AI** → your Support agent (or create one).
2. **System prompt:** Use the prompt from `backend/support_agent_config.py` (or GET `https://YOUR_HOST/support-agent/config` and copy `system_prompt`).
3. **Tools:** Add each Custom Tool from `SUPPORT_AGENT_TOOLS` in `support_agent_config.py`.  
   - Webhook URL: **`https://YOUR_NGROK_OR_DOMAIN/support-agent/webhook`**  
   - Method: **POST**
4. **Voice / model:** Choose a voice and model (e.g. `eleven_turbo_v2_5`).

Full setup details: **docs/SUPPORT_AGENT_ELEVENLABS.md**.

## 4. Try a task

**Text (e.g. in your app or API):**  
Send a user message that triggers a task, e.g. “Find me a dentist” or “Book a haircut.” The frontend (or your client) should call the ElevenLabs Conversational AI API with that message; the agent will call the webhook with `find_provider`, then `query_calendar`, `check_availability`, `validate_slot`, `schedule_appointment` as needed.

**Voice:**  
Start a conversation with the Support agent in the ElevenLabs playground (or your app using the ElevenLabs SDK) and say the same things, e.g. “I need to find a doctor” or “Reschedule my dentist appointment.”

## 5. Example prompts

See **demo/example_prompts.txt** for copy-paste prompts for all 10 tasks.

## Troubleshooting

- **404 on webhook:** Restart the backend and confirm GET **/support-agent** returns 200. Webhook path must be exactly **/support-agent/webhook** (no trailing slash).
- **No providers found:** Ensure `data/support_services.json` and `data/mock_providers.json` exist and include the service type (doctor, dentist, vet, salon, etc.). Fitness and home_cleaning were added for the 10-task demo.
- **DEMO_MODE:** Default is `true`; calendar is treated as free so bookings succeed without a real calendar. Set `DEMO_MODE=false` and configure calendar if you want real free-busy checks.
