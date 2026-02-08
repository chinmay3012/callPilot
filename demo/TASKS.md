# Support Agent Tasks – Find → Decide → Act

Each task is executed **end-to-end** by the Support Agent using **tools** (no hardcoded responses). Same flow: **find** providers → **decide** with user (calendar, availability) → **act** (schedule / reschedule / cancel).

---

## 1. Find & Book a Doctor

**User intent:** Get a doctor appointment (primary care / family medicine).

**Sample inputs (text or voice):**
- “I need to find a doctor.”
- “Book me a doctor appointment for next week.”
- “Find a primary care physician near me.”

**Tool sequence:**
1. `find_provider(service_type="doctor", location?, max_distance_miles?, min_rating?)`
2. Optionally `query_calendar(for_date="today"|"tomorrow"|YYYY-MM-DD)`
3. `get_provider_details(provider_name)` if user asks about one option
4. `check_availability(provider_name, for_date?)`
5. `validate_slot(slot_time, provider_name)`
6. `schedule_appointment(provider_name, slot_time, service_type="doctor", reasoning)`

**Done when:** User receives a confirmation (e.g. “Your doctor appointment with Dr. James Park is confirmed for 10:30 AM Tuesday.”).

---

## 2. Find & Book a Dentist

**User intent:** Book a dental checkup or dental visit.

**Sample inputs:**
- “Find me a dentist.”
- “I need a dental checkup.”
- “Book a dentist appointment for tomorrow afternoon.”

**Tool sequence:** Same as doctor; `service_type="dentist"`. Dentists are loaded from `data/mock_providers.json`; other services from `data/support_services.json`.

**Done when:** Confirmation with dentist name and time.

---

## 3. Find & Book a Vet

**User intent:** Book a veterinary appointment (pet care).

**Sample inputs:**
- “I need a vet for my dog.”
- “Book a vet appointment.”
- “Find a veterinarian near me.”

**Tool sequence:** Same as doctor; `service_type="vet"`.

**Done when:** Confirmation with vet name and time.

---

## 4. Find & Book a Therapist

**User intent:** Book counseling or therapy.

**Sample inputs:**
- “I’d like to see a therapist.”
- “Book a counseling session.”
- “Find me a therapist.”

**Tool sequence:** Same as doctor; `service_type="therapist"`.

**Done when:** Confirmation with therapist name and time.

---

## 5. Book a Haircut / Salon Appointment

**User intent:** Book a haircut or salon visit.

**Sample inputs:**
- “Book a haircut.”
- “I need a salon appointment.”
- “Find a barber for Saturday.”

**Tool sequence:** Same as doctor; `service_type="salon"`. Natural language maps “haircut”, “barber”, “salon” to `salon`.

**Done when:** Confirmation with salon name and time.

---

## 6. Call & Schedule Auto Repair

**User intent:** Schedule car repair or mechanic visit.

**Sample inputs:**
- “Schedule my car for repair.”
- “Find an auto mechanic.”
- “I need to get my car serviced.”

**Tool sequence:** Same as doctor; `service_type="auto_repair"`. Phrases like “mechanic”, “car repair” map to `auto_repair`.

**Done when:** Confirmation with auto repair shop name and time.

---

## 7. Find & Call a Plumber

**User intent:** Schedule a plumber (e.g. leak, installation).

**Sample inputs:**
- “I need a plumber.”
- “Find and schedule a plumber.”
- “My sink is leaking, I need someone to come out.”

**Tool sequence:** Same as doctor; `service_type="plumber"`.

**Done when:** Confirmation with plumber name and time.

---

## 8. Find & Schedule Home Cleaning

**User intent:** Book a house cleaning or cleaning service.

**Sample inputs:**
- “Book a house cleaning.”
- “Find a cleaner for next week.”
- “I need home cleaning scheduled.”

**Tool sequence:** Same as doctor; `service_type="home_cleaning"`. Phrases like “house cleaning”, “maid”, “cleaner” map to `home_cleaning`.

**Done when:** Confirmation with cleaning service name and time.

---

## 9. Schedule a Fitness Class / Personal Trainer

**User intent:** Book a fitness class or personal training session.

**Sample inputs:**
- “Book a fitness class.”
- “I want a personal trainer.”
- “Schedule a yoga class.”

**Tool sequence:** Same as doctor; `service_type="fitness"`. Phrases like “personal trainer”, “gym”, “yoga class”, “pilates” map to `fitness`.

**Done when:** Confirmation with gym/studio name and time.

---

## 10. Reschedule or Cancel an Existing Appointment

**User intent:** Change the time of an existing appointment or cancel it.

**Sample inputs (reschedule):**
- “Reschedule my dentist appointment to Thursday afternoon.”
- “I need to move my doctor appointment to next week.”

**Sample inputs (cancel):**
- “Cancel my appointment with Dr. Park.”
- “Cancel my vet appointment.”

**Tool sequence (reschedule):**
1. `list_my_appointments()`
2. Identify the appointment (provider name).
3. `validate_slot(slot_time, provider_name)` for the **new** time.
4. `reschedule_appointment(provider_name, new_slot_time, reason?)`

**Tool sequence (cancel):**
1. `list_my_appointments()`
2. Identify the appointment.
3. `cancel_appointment(provider_name, reason?)`

**Done when:** User is told the appointment was rescheduled to the new time, or that it was cancelled.

---

## Shared Behavior

- **Clarifying questions:** The agent may ask location, preferred time, or rating/distance preferences before or after `find_provider`.
- **No fabrication:** Only provider names and slots returned by tools are used; the agent does not invent providers or times.
- **Voice-ready:** All sample inputs work when spoken to the ElevenLabs Support Agent; the same webhook and tools are used.
- **Handover:** If the agent is uncertain (e.g. medical advice, policy), it can call `request_human_handover(reason, confidence)` and tell the user they are being connected to a human.
