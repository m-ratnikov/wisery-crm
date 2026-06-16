# prospect-list - delta

The auto-enrich requirement is reworded to stop claiming qualification-based routing
(qualification was removed by ADR-0022; the `ProspectQualified` trigger it hung on was
retired by ADR-0019). The setting is kept and still persists; it simply routes nothing
today, reserved for a future auto-enrich-on-approval.

## MODIFIED Requirements

### Requirement: The user controls auto-enrich from the list

The system SHALL let a user turn the auto-enrich setting on or off from the prospect list, and SHALL persist the chosen value. The setting does NOT currently route any enrichment - the qualification trigger it once governed no longer exists (ADR-0019, ADR-0022) - and it is reserved for a future auto-enrich-on-approval (auto-enqueueing enrichment when the user approves a signal). Enrichment today is triggered only by the explicit single and batch actions.

#### Scenario: Toggling auto-enrich persists the setting

- **WHEN** a user turns auto-enrich on (or off)
- **THEN** the setting is persisted

#### Scenario: The setting routes no enrichment today

- **WHEN** auto-enrich is on and a person is created (by approval or by hand)
- **THEN** no enrichment is enqueued automatically - enrichment is requested only by the explicit single or batch action
