# engagement-posts Specification

## Purpose

Letting the CRM user watch the people worth engaging and see their recent activity: fetch a person's posts on demand, keep monitored people's posts fresh with a scheduled scan, and browse them in a Feed. This is the read-and-store substrate for the engagement motion - no content is sent anywhere here.

## Architecture

- Decisions: [ADR-0018](../../../docs/adr/0018-engagement-artifacts-post-comment.md) (Post), [ADR-0015](../../../docs/adr/0015-prospect-to-person-with-type.md) (`monitored`), [ADR-0007](../../../docs/adr/0007-user-triggered-optional-enrichment.md) (user-triggered, cost-bounded fetch). Port: the `EnrichmentProvider` (D4) gains `fetchPosts`.
- Data model: the `Post` entity and `Person.monitored` in [domain-model.md](../../../docs/architecture/domain-model.md); the engagement loop in [system-design.md](../../../docs/architecture/system-design.md).
- Surface: the Feed (anchor view #4) and the person detail; see the [prototype registry](../../../src/app/prototype/README.md).

## ADDED Requirements

### Requirement: The CRM user fetches a person's recent posts on demand

The system SHALL let the CRM user fetch a person's recent posts from the person detail. The fetch SHALL be user-triggered (not automatic), idempotent, and SHALL store each post once. A post with no stable identifier SHALL be dropped rather than stored, and a person with no available activity SHALL yield nothing rather than a fabricated post.

#### Scenario: Fetching posts stores them once

- **WHEN** the CRM user clicks "get latest posts" on a person
- **THEN** the person's recent posts are fetched and stored, one row per post
- **AND** fetching again does not create duplicate posts

#### Scenario: Thin activity yields nothing

- **WHEN** a person has no available posts or no post has a stable identifier
- **THEN** no post is stored and nothing is fabricated

### Requirement: Monitored people's posts stay fresh and appear in the Feed

The system SHALL let the CRM user flag a person as `monitored`, and SHALL keep monitored people's posts fresh via a scheduled activity scan that fetches each monitored person independently. The Feed SHALL show recent posts from monitored people, newest first, filterable by person.

#### Scenario: A monitored person's posts refresh on the scan

- **WHEN** the activity scan runs
- **THEN** each monitored person's recent posts are fetched independently and stored idempotently
- **AND** one person's fetch failure does not stop the others

#### Scenario: The Feed lists monitored people's posts

- **WHEN** the CRM user opens the Feed
- **THEN** recent posts from monitored people are listed newest first
- **AND** the list can be filtered to one person
