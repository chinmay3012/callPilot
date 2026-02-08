#!/usr/bin/env python3
"""
Terminal "chat" with CallPilot Support Agent tools.
Sends tool-call payloads to the local backend webhook and prints results.
Run with backend up: python3 scripts/chat_with_agent_tools.py
"""
import json
import sys

try:
    import requests
except ImportError:
    print("Install requests: pip install requests")
    sys.exit(1)

WEBHOOK = "http://localhost:8000/support-agent/webhook"


def call_tool(tool_name: str, arguments: dict) -> dict:
    """POST to support-agent webhook; return tool_result or error."""
    payload = {"tool_name": tool_name, "arguments": arguments}
    try:
        r = requests.post(WEBHOOK, json=payload, timeout=15)
        r.raise_for_status()
        data = r.json()
        return data.get("tool_result") or data
    except requests.RequestException as e:
        return {"error": str(e)}
    except json.JSONDecodeError as e:
        return {"error": f"Invalid JSON: {e}"}


def main():
    print("CallPilot Support Agent — terminal tool chat")
    print("Backend:", WEBHOOK)
    print("-" * 50)
    print("Examples: find dentist | calendar | list appointments | availability <name> | quit")
    print()

    while True:
        try:
            line = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            break
        if not line:
            continue
        lower = line.lower()

        if lower in ("q", "quit", "exit"):
            print("Bye.")
            break

        # Map simple phrases to tool calls (same as agent would do)
        if lower.startswith("find ") or lower.startswith("book ") or "dentist" in lower or "doctor" in lower:
            service = "dentist"
            if "doctor" in lower:
                service = "doctor"
            elif "vet" in lower:
                service = "vet"
            elif "salon" in lower or "haircut" in lower:
                service = "salon"
            elif "plumber" in lower:
                service = "plumber"
            elif "therapist" in lower:
                service = "therapist"
            elif "auto" in lower or "mechanic" in lower:
                service = "auto_repair"
            elif "cleaning" in lower or "cleaner" in lower:
                service = "home_cleaning"
            elif "fitness" in lower or "trainer" in lower:
                service = "fitness"
            else:
                for w in line.split():
                    if w.lower() in ("dentist", "doctor", "vet", "salon", "plumber", "therapist", "fitness"):
                        service = w.lower() if w.lower() != "cleaning" else "home_cleaning"
                        break
            result = call_tool("find_provider", {"service_type": service})
            print("Agent (find_provider):", json.dumps(result, indent=2)[:1200])
            if len(json.dumps(result)) > 1200:
                print("... (truncated)")

        elif "calendar" in lower or "appointments" in lower or "bookings" in lower or "what do i have" in lower:
            result = call_tool("list_my_appointments", {})
            print("Agent (list_my_appointments):", json.dumps(result, indent=2)[:1200])
            if len(json.dumps(result)) > 1200:
                print("... (truncated)")

        elif lower.startswith("availability ") or lower.startswith("slots "):
            name = line.split(maxsplit=1)[-1].strip()
            result = call_tool("check_availability", {"provider_name": name})
            print("Agent (check_availability):", json.dumps(result, indent=2)[:1200])

        else:
            # Default: treat as find_provider with first word or "doctor"
            result = call_tool("find_provider", {"service_type": lower.split()[0] if lower.split() else "doctor"})
            print("Agent (find_provider):", json.dumps(result, indent=2)[:1200])

        print()


if __name__ == "__main__":
    main()
