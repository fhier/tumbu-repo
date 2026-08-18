# Acceptance - {{DOMAIN}}

## Happy Path
### Scenario: Create Valid
Given preconditions
When Action
Then success + event

## Edge Cases - Data Integrity
### Scenario: Invalid Input
When Create with invalid data
Then Error INV-XXX-001

### Scenario: Duplicate
Given existing
When Create duplicate
Then Error INV-XXX-001

## Edge Cases - Workflow
### Scenario: Forbidden Transition
Given state CLOSED
When Action that requires ACTIVE
Then Error WORKFLOW

### Scenario: Cross Domain Check Fails
Given parent not ACTIVE
When Create child
Then Error INV-XXX-00X

## Edge Cases - Transactional
### Scenario: After Terminal State
Given CLOSED
When Any write
Then Error WORKFLOW - already closed
