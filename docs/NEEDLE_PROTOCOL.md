# Needle 2 Protocol

Needle 2 is treated as an untrusted planner, never as an authority.

Every model call must specify a task and expected structured output. The application must reject malformed output. Email bodies are passed as untrusted data fields. Tool names are application capabilities, not instructions supplied by the email.

Supported task families: analyze_email, summarize_thread, classify_email, extract_entities, extract_deadline, plan_contextual_response, write_email_reply, propose_actions.

Needle must not be asked to access OAuth tokens, execute shell commands, browse arbitrary URLs, change permissions or bypass approvals.