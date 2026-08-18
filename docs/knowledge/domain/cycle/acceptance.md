# Acceptance - Cycle - With Edge Cases

## Happy Path
### Scenario: Open First Cycle
Given Pond p1 has no ACTIVE Cycle
When Open Cycle pondId=p1
Then status ACTIVE, event CycleOpened

### Scenario: Final Harvest Closes Cycle
Given Cycle c1 ACTIVE
When Harvest type=FINAL amount=100kg
Then Cycle status CLOSED, event CycleClosed reason=HARVEST_FINAL

## Edge Cases - Workflow
### Scenario: Open Second Active Cycle in Same Pond
Given Pond p1 has Cycle c1 ACTIVE
When Open Cycle pondId=p1
Then Error INV-CYCLE-001

### Scenario: Reopen Closed Cycle
Given Cycle c1 CLOSED
When Open Cycle pondId=p1
Then Error INV-CYCLE-002 (or create new Cycle allowed, but reopen forbidden)

### Scenario: Open Cycle Without Pond
When Open Cycle pondId=null
Then Error INV-CYCLE-006

### Scenario: Open Cycle with Non-Existing Pond
Given Pond p999 not exists
When Open Cycle pondId=p999
Then Error INV-CYCLE-006

## Edge Cases - Harvest
### Scenario: Harvest on Closed Cycle
Given Cycle c1 CLOSED
When Harvest pondId=p1 cycleId=c1
Then Error WORKFLOW - Cycle already closed

### Scenario: Mortality Exceeds Population
Given Cycle initial=1000, mortality cumulative=1000
When Record Mortality 1
Then Error INV-CYCLE-004
