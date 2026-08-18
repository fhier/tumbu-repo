# Lifecycle - {{DOMAIN}}

State Machine:
[DRAFT] --Trigger--> [ACTIVE] --Trigger--> [CLOSED]

Terminal States: [CLOSED]

Transitions:
- DRAFT -> ACTIVE : Activate
- ACTIVE -> CLOSED : Close

Forbidden:
- CLOSED -> any
- ACTIVE -> DRAFT

Enforcement: Aggregate for self-check, Domain Service for cross-domain
