# CallPilot Demo – Everyday Task Automation

This directory explains and showcases **10+ real-world tasks** that the Support Agent can run **end-to-end**: **find → decide → act**. It is intended for users, investors, and judges to understand what the prototype does and how to try it.

## What This Is

**CallPilot** is a prototype for the future of everyday task automation. A single voice or text agent:

1. **Finds** relevant providers (doctors, vets, salons, plumbers, etc.) using tools—no hardcoded replies.
2. **Decides** with the user: checks calendar, availability, and preferences.
3. **Acts** by scheduling, rescheduling, or cancelling appointments via the same tool-calling architecture.

All tasks work via **text input** (e.g. in the app or API) and are **voice-ready** via **ElevenLabs** Conversational AI. The agent uses **tools** (find_provider, query_calendar, check_availability, validate_slot, schedule_appointment, list_my_appointments, reschedule_appointment, cancel_appointment, etc.) instead of hardcoded responses.

---

## The 10 Supported Tasks

| # | Task | How to trigger (text or voice) | Tools used |
|---|------|--------------------------------|------------|
| 1 | **Find & book a doctor** | “I need to find a doctor” / “Book me a doctor appointment” | find_provider(doctor) → query_calendar → check_availability → validate_slot → schedule_appointment |
| 2 | **Find & book a dentist** | “Find me a dentist” / “I need a dental checkup” | find_provider(dentist) → … → schedule_appointment |
| 3 | **Find & book a vet** | “I need a vet for my dog” / “Book a vet appointment” | find_provider(vet) → … → schedule_appointment |
| 4 | **Find & book a therapist** | “I’d like to see a therapist” / “Book counseling” | find_provider(therapist) → … → schedule_appointment |
| 5 | **Book a haircut / salon** | “Book a haircut” / “I need a salon appointment” | find_provider(salon) → … → schedule_appointment |
| 6 | **Call & schedule auto repair** | “Schedule my car for repair” / “Find an auto mechanic” | find_provider(auto_repair) → … → schedule_appointment |
| 7 | **Find & call a plumber** | “I need a plumber” / “Schedule a plumber” | find_provider(plumber) → … → schedule_appointment |
| 8 | **Find & schedule home cleaning** | “Book a house cleaning” / “Find a cleaner” | find_provider(home_cleaning) → … → schedule_appointment |
| 9 | **Schedule a fitness class / personal trainer** | “Book a fitness class” / “I want a personal trainer” | find_provider(fitness) → … → schedule_appointment |
| 10 | **Reschedule or cancel an existing appointment** | “Reschedule my dentist appointment” / “Cancel my appointment with Dr. Park” | list_my_appointments → reschedule_appointment / cancel_appointment (after validate_slot for reschedule) |

Each task follows the same **find → decide → act** pattern and uses the **same tool set**; only the `service_type` (and user intent) changes.

---

## How to Run a Demo

1. **Quick start (backend + webhook)**  
   See **[QUICK_START.md](./QUICK_START.md)** for minimal steps: start the backend, expose it (e.g. ngrok), and point the ElevenLabs Support Agent webhook at it.

2. **Example prompts (text & voice)**  
   See **[example_prompts.txt](./example_prompts.txt)** for copy-paste prompts you can use in the app or when testing with voice.

3. **Task-by-task flows**  
   See **[TASKS.md](./TASKS.md)** for each of the 10 tasks with sample user inputs, expected tool sequence, and what “done” looks like.

---

## For Investors & Judges

- **Architecture:** One Support Agent in ElevenLabs; all logic is tool-driven (find → decide → act). No task-specific hardcoding—new service types can be added via data (`data/support_services.json`) and service-type hints in the backend.
- **Scope:** 10 distinct task categories above; reschedule/cancel reuse the same tools (list_my_appointments, reschedule_appointment, cancel_appointment).
- **Voice + text:** Same agent and webhook support both ElevenLabs voice and text input (e.g. from the frontend).
- **Demo data:** Providers and slots are simulated in `data/support_services.json` and `data/receptionist_simulation.json` so every task can be demonstrated without real provider APIs.

---

## File Overview

| File | Purpose |
|------|--------|
| **README.md** (this file) | Overview of the 10 tasks and how the demo is structured. |
| **TASKS.md** | Detailed flows for each task: sample inputs, tool order, success criteria. |
| **QUICK_START.md** | Minimal steps to run the backend and connect ElevenLabs. |
| **example_prompts.txt** | Copy-paste prompts for demos (text and voice-ready). |
