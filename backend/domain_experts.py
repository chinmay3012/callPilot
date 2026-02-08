"""
CallPilot - Domain Expert Voice Agents

Specialized experts (health, fitness/therapy) routed when deeper knowledge is required.
Returns suggested_expert and optional prompt_hint for the main Support Agent or for switching agent.
"""
from typing import Optional, Tuple

# Expert types supported for routing
EXPERT_TYPES = frozenset({"health", "fitness_therapy", "general"})

# Keywords that suggest need for health expert (symptoms, prescriptions, medical)
HEALTH_HINTS = [
    "symptom", "pain", "prescription", "medication", "diagnosis", "heart", "blood",
    "allergy", "chronic", "infection", "covid", "vaccine", "referral", "specialist",
    "medical history", "insurance", "lab result", "x-ray", "test result",
]

# Keywords that suggest fitness or therapy / mental health expert
FITNESS_THERAPY_HINTS = [
    "fitness", "therapy", "mental health", "counseling", "counselling", "exercise",
    "pt ", "physical therapy", "physiotherapy", "rehab", "anxiety", "depression",
    "workout", "trainer", "nutrition", "diet", "wellness", "mindful", "lmft", "lmhc",
]


def suggest_domain_expert(user_input: Optional[str], service_type: Optional[str]) -> Tuple[str, Optional[str]]:
    """
    Suggest which domain expert should handle this (for routing or prompt hint).
    Returns (expert_type, prompt_hint).
    expert_type: "health" | "fitness_therapy" | "general"
    prompt_hint: optional instruction for the agent (e.g. "User may need health-specific guidance").
    """
    if not user_input and not service_type:
        return "general", None
    text = (user_input or "") + " " + (service_type or "")
    text = text.lower().strip()
    if not text:
        return "general", None

    health_score = sum(1 for h in HEALTH_HINTS if h in text)
    fitness_score = sum(1 for h in FITNESS_THERAPY_HINTS if h in text)

    if health_score > fitness_score and health_score > 0:
        return "health", "User may need health-specific guidance. Be careful not to give medical advice; recommend speaking with a provider or hand over to human for clinical questions."
    if fitness_score > 0:
        return "fitness_therapy", "User may need fitness or therapy scheduling. You can help with finding providers and booking; for clinical advice suggest they speak with the provider."
    return "general", None


def get_expert_routing_for_tool_result(user_message: Optional[str], service_type: Optional[str]) -> dict:
    """
    Call from webhook or tools to attach suggested_expert to tool_result so client or agent can route.
    """
    expert_type, hint = suggest_domain_expert(user_message, service_type)
    out = {"suggested_expert": expert_type}
    if hint:
        out["expert_prompt_hint"] = hint
    return out
