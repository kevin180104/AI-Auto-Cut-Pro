# Architecture Decisions

## ADR-0001 — Keep processing independent of Audition
**Status:** Accepted for initial investigation.

Put validation, speech analysis, edit decisions, and rendering in a standalone engine. Add an Audition adapter/panel only for workflows the versioned SDK demonstrably supports. Adobe documents CEP panels, file analysis, session exchange, metadata, and preview/control surfaces, but the public material reviewed does not prove every required editing operation is exposed stably.

## ADR-0002 — Review-first edits
**Status:** Accepted.

High-confidence, mechanically verifiable decisions may be proposed for automation. Uncertain speech, script mismatches, and names/numbers require human review. False deletion or content changes are more costly than asking a person to review a segment.

## ADR-0003 — Immutable source and auditable EDL
**Status:** Accepted.

Preserve inputs, render to a new path, and retain an EDL with source/output ranges and decision provenance so edits can be reversed and traced.
