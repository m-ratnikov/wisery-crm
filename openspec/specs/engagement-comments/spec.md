# engagement-comments Specification

## Purpose
TBD - created by archiving change engagement-comments. Update Purpose after archive.
## Requirements
### Requirement: The CRM user generates and posts an AI comment by hand

The system SHALL let the CRM user generate an AI-drafted comment on a post, grounded in the person's information and the global comment guidance. Generation SHALL be synchronous and SHALL write a new comment each time (so regenerating produces another draft, not an overwrite). The user SHALL be able to edit, copy, post the comment manually, and mark it posted, or dismiss it. The system SHALL NOT post any comment automatically.

#### Scenario: Generating a comment on a post

- **WHEN** the CRM user generates a comment on a post
- **THEN** a new comment is created (status generated) from the person's info and the global guidance
- **AND** regenerating creates another comment rather than overwriting the first

#### Scenario: The human posts the comment

- **WHEN** the CRM user posts a generated comment manually and marks it posted
- **THEN** that comment's status becomes posted
- **AND** no comment is ever published by the system itself

### Requirement: Comment guidance is editable global config

The system SHALL let the CRM user edit a global comment guidance (tone and rules) as versioned config-as-data, and SHALL ground every generated comment in the currently active guidance.

#### Scenario: Editing the guidance affects new comments

- **WHEN** the CRM user saves a new comment guidance
- **THEN** subsequently generated comments are grounded in the updated guidance

