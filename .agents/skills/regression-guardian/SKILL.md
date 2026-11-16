---
name: regression-guardian
description: Protect AI Auto Cut Pro behavior from recurring defects when changing algorithms, EDL, rendering, script alignment, or Audition adapters. Use before and after changes to sensitive paths.
---

# Regression Guardian

## Workflow
1. Read related error-memory entries and existing tests before editing.
2. Identify affected invariants: source preservation, speech completeness, sample-accurate ranges, protected script tokens, reversible EDL, and output validation.
3. Map each invariant to a focused automated check or mark it NOT TESTED/BLOCKED.
4. Make the change and run relevant checks requested for the task.
5. Compare with baseline; inspect failures rather than weakening assertions.
6. Update defect memory and compatibility evidence when behavior or supported versions change.

## Required regression scenarios
- Preserve an initial phoneme after a cut.
- Keep dates, identifiers, names, and spoken amounts intact.
- Select a best take that is not the final take.
- Preserve intentional repetition and expressive pauses.
- Keep original audio unchanged and reproduce output from EDL.
- Distinguish mocks from real Audition-host checks.

## Reporting
Report PASS, FAIL, NOT TESTED, or BLOCKED for every check with command/environment and limitations. Never report all-clear from build-only results.
