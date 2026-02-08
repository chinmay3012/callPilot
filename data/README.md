# CallPilot Demo Data

This directory holds **provider directory** and **receptionist simulation** data for the full workflow demo.

## Provider directory

- **`provider_directory.json`** — Single source for demo providers across all service types (dentist, doctor, vet, plumber, salon, auto_repair, therapist). Each provider has:
  - `id`, `name`, `service_type`, `rating`, `distanceMiles`
  - Optional: `address`, `phone`, `hours`, `specialty`
  - For dentists used in swarm: `elevenlabsReady`

- **`mock_providers.json`** — Used by the **swarm** (Find Dentist button) for the five parallel dentist agents. Keep in sync with dentists in `provider_directory.json` if you edit there.

- **`support_services.json`** — Used by the **Support Agent** (Talk to CallPilot) for `find_provider` by service type. Dentists are loaded from `mock_providers.json` in code; other types come from this file.

Use **`provider_directory.json`** as the canonical demo directory; sync or generate `mock_providers` / `support_services` from it if you want one source of truth.

## Receptionist simulation

- **`receptionist_simulation.json`** — Simulates receptionist behavior for the demo:
  - **`defaultSlots`** — Default offered times when no per-provider data.
  - **`receptionistPhrases`** — Optional greeting/confirm phrases (for future use).
  - **`byProviderId`** — Per-provider slot lists (e.g. `agent-1`, `agent-2`). The swarm and Support Agent `check_availability` use these so each “receptionist” offers different slots.

When you run **Find Dentist** or ask the Support Agent for availability, the backend uses these slots so the demo behaves like multiple receptionists with different availability.

## Full workflow showcase

1. **Find Dentist (swarm)** — Loads dentists from `mock_providers.json`; simulates calls and uses per-provider slots from `receptionist_simulation.json` when present.
2. **Talk to CallPilot (Support Agent)** — `find_provider` uses `support_services.json` + dentists from `mock_providers.json`; `check_availability` uses `receptionist_simulation.json`; `schedule_appointment` writes to `bookings_appointments.json` (created at runtime).

To add a new demo provider, add an entry to `provider_directory.json` and, if it’s a dentist, to `mock_providers.json` (and optionally to `support_services.json` under the right service type). To give a provider its own “receptionist” slots, add an entry under `byProviderId` in `receptionist_simulation.json`.
