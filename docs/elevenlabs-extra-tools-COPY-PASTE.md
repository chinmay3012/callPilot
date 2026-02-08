# ElevenLabs – Extra tools (copy & paste)

Same format and webhook URL as `elevenlabs-schedule_appointment-tool.json`. Paste each block into ElevenLabs → Agent → Tools → Add Custom Tool (or import). If your webhook host is different, replace the `url` in each JSON.

---

## 1. list_my_appointments

```json
{"type":"webhook","name":"list_my_appointments","description":"List the user's existing appointments (upcoming and recent). Use when they ask to reschedule, cancel, or see their bookings.","disable_interruptions":false,"force_pre_tool_speech":"auto","tool_call_sound":null,"tool_call_sound_behavior":"auto","tool_error_handling_mode":"auto","execution_mode":"immediate","api_schema":{"url":"https://nonconsecutively-semiexpository-lorie.ngrok-free.dev/support-agent/webhook","method":"POST","path_params_schema":[],"query_params_schema":[],"request_headers":[],"auth_connection":null,"request_body_schema":{"id":"body","type":"object","description":"Envelope for listing the user's appointments via the support agent.","required":true,"properties":[{"id":"tool_name","type":"string","value_type":"constant","constant_value":"list_my_appointments","dynamic_variable":"","description":"Name of the tool being invoked.","required":true,"enum":null},{"id":"input","type":"object","value_type":"llm_prompt","description":"No parameters needed; optional_note is unused.","required":true,"properties":[{"id":"optional_note","type":"string","value_type":"llm_prompt","dynamic_variable":"","constant_value":"","description":"Optional; leave empty. No parameters needed for this tool.","required":false,"enum":null}]}],"value_type":"llm_prompt"}},"response_timeout_secs":20,"dynamic_variables":{"dynamic_variable_placeholders":{}},"assignments":[]}
```

---

## 2. reschedule_appointment

```json
{"type":"webhook","name":"reschedule_appointment","description":"Reschedule an existing appointment to a new time. Call after list_my_appointments to identify the appointment, then validate_slot for the new time.","disable_interruptions":false,"force_pre_tool_speech":"auto","tool_call_sound":null,"tool_call_sound_behavior":"auto","tool_error_handling_mode":"auto","execution_mode":"immediate","api_schema":{"url":"https://nonconsecutively-semiexpository-lorie.ngrok-free.dev/support-agent/webhook","method":"POST","path_params_schema":[],"query_params_schema":[],"request_headers":[],"auth_connection":null,"request_body_schema":{"id":"body","type":"object","description":"Envelope for rescheduling an appointment via the support agent.","required":true,"properties":[{"id":"tool_name","type":"string","value_type":"constant","constant_value":"reschedule_appointment","dynamic_variable":"","description":"Name of the tool being invoked.","required":true,"enum":null},{"id":"input","type":"object","value_type":"llm_prompt","description":"Provider and new slot time. Must include provider_name and new_slot_time.","required":true,"properties":[{"id":"provider_name","type":"string","value_type":"llm_prompt","dynamic_variable":"","constant_value":"","description":"Provider of the existing appointment (e.g. Dr. Sarah Chen, Bright Smiles Co.).","required":true,"enum":null},{"id":"new_slot_time","type":"string","value_type":"llm_prompt","dynamic_variable":"","constant_value":"","description":"New requested time (e.g. 2:00 PM Thursday, tomorrow at 10:00 AM).","required":true,"enum":null},{"id":"reason","type":"string","value_type":"llm_prompt","dynamic_variable":"","constant_value":"","description":"Optional reason for rescheduling.","required":false,"enum":null}]}],"value_type":"llm_prompt"}},"response_timeout_secs":20,"dynamic_variables":{"dynamic_variable_placeholders":{}},"assignments":[]}
```

---

## 3. cancel_appointment

```json
{"type":"webhook","name":"cancel_appointment","description":"Cancel an existing appointment. Use when the user clearly wants to cancel. Confirm which appointment (provider name) before calling.","disable_interruptions":false,"force_pre_tool_speech":"auto","tool_call_sound":null,"tool_call_sound_behavior":"auto","tool_error_handling_mode":"auto","execution_mode":"immediate","api_schema":{"url":"https://nonconsecutively-semiexpository-lorie.ngrok-free.dev/support-agent/webhook","method":"POST","path_params_schema":[],"query_params_schema":[],"request_headers":[],"auth_connection":null,"request_body_schema":{"id":"body","type":"object","description":"Envelope for cancelling an appointment via the support agent.","required":true,"properties":[{"id":"tool_name","type":"string","value_type":"constant","constant_value":"cancel_appointment","dynamic_variable":"","description":"Name of the tool being invoked.","required":true,"enum":null},{"id":"input","type":"object","value_type":"llm_prompt","description":"Provider to cancel. Must include provider_name.","required":true,"properties":[{"id":"provider_name","type":"string","value_type":"llm_prompt","dynamic_variable":"","constant_value":"","description":"Provider of the appointment to cancel (e.g. Dr. Sarah Chen, Bright Smiles Co.).","required":true,"enum":null},{"id":"reason","type":"string","value_type":"llm_prompt","dynamic_variable":"","constant_value":"","description":"Optional reason for cancellation.","required":false,"enum":null}]}],"value_type":"llm_prompt"}},"response_timeout_secs":20,"dynamic_variables":{"dynamic_variable_placeholders":{}},"assignments":[]}
```

---

## 4. request_human_handover

```json
{"type":"webhook","name":"request_human_handover","description":"Transfer to a human when you are uncertain, lack information, or risk fabrication (e.g. medical advice, policy). Prefer self-awareness over sounding fluent. Call this and tell the user you are connecting them to a team member.","disable_interruptions":false,"force_pre_tool_speech":"auto","tool_call_sound":null,"tool_call_sound_behavior":"auto","tool_error_handling_mode":"auto","execution_mode":"immediate","api_schema":{"url":"https://nonconsecutively-semiexpository-lorie.ngrok-free.dev/support-agent/webhook","method":"POST","path_params_schema":[],"query_params_schema":[],"request_headers":[],"auth_connection":null,"request_body_schema":{"id":"body","type":"object","description":"Envelope for requesting human handover via the support agent.","required":true,"properties":[{"id":"tool_name","type":"string","value_type":"constant","constant_value":"request_human_handover","dynamic_variable":"","description":"Name of the tool being invoked.","required":true,"enum":null},{"id":"input","type":"object","value_type":"llm_prompt","description":"Reason for handover. Must include reason.","required":true,"properties":[{"id":"reason","type":"string","value_type":"llm_prompt","dynamic_variable":"","constant_value":"","description":"Why handover is needed (e.g. User asked medical advice, Unclear insurance policy).","required":true,"enum":null},{"id":"confidence","type":"string","value_type":"llm_prompt","dynamic_variable":"","constant_value":"","description":"How uncertain you are: low, medium, or high.","required":false,"enum":null}]}],"value_type":"llm_prompt"}},"response_timeout_secs":20,"dynamic_variables":{"dynamic_variable_placeholders":{}},"assignments":[]}
```

---

## 5. register_waitlist

```json
{"type":"webhook","name":"register_waitlist","description":"Add the user to a provider's waitlist for a callback when a slot opens. Use when no slots are available but the user wants to be notified.","disable_interruptions":false,"force_pre_tool_speech":"auto","tool_call_sound":null,"tool_call_sound_behavior":"auto","tool_error_handling_mode":"auto","execution_mode":"immediate","api_schema":{"url":"https://nonconsecutively-semiexpository-lorie.ngrok-free.dev/support-agent/webhook","method":"POST","path_params_schema":[],"query_params_schema":[],"request_headers":[],"auth_connection":null,"request_body_schema":{"id":"body","type":"object","description":"Envelope for registering on a provider waitlist via the support agent.","required":true,"properties":[{"id":"tool_name","type":"string","value_type":"constant","constant_value":"register_waitlist","dynamic_variable":"","description":"Name of the tool being invoked.","required":true,"enum":null},{"id":"input","type":"object","value_type":"llm_prompt","description":"Provider and optional preferences. Must include provider_name.","required":true,"properties":[{"id":"provider_name","type":"string","value_type":"llm_prompt","dynamic_variable":"","constant_value":"","description":"Provider to join waitlist for (e.g. Dr. Sarah Chen, Bright Smiles Co.).","required":true,"enum":null},{"id":"preferred_times","type":"string","value_type":"llm_prompt","dynamic_variable":"","constant_value":"","description":"Optional preferred times (e.g. mornings, any).","required":false,"enum":null},{"id":"callback_phone","type":"string","value_type":"llm_prompt","dynamic_variable":"","constant_value":"","description":"Optional phone number for callback.","required":false,"enum":null}]}],"value_type":"llm_prompt"}},"response_timeout_secs":20,"dynamic_variables":{"dynamic_variable_placeholders":{}},"assignments":[]}
```

---

**Tip:** If your webhook host is different, replace the `url` value in each JSON (e.g. your ngrok or production host).
