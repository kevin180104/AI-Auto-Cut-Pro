---
name: error-memory-manager
description: Record, diagnose, resolve, and prevent reproducible AI Auto Cut Pro defects. Use whenever a bug or regression is found, especially audio boundary or speech-content loss.
---

# Error Memory Manager

Follow `READ → REPRODUCE → ANALYZE → FIX → TEST → UPDATE MEMORY → VALIDATE → REPORT`.

## Workflow
1. Inspect `.ai/ERROR_MEMORY.md` and related regression coverage before changing code.
2. Record symptom, build, input characteristics, and safe reproduction steps. Do not copy private audio into the repository.
3. Reproduce the defect or mark it BLOCKED; do not infer a cause from symptoms alone.
4. Identify the root cause and fix the narrowest appropriate layer.
5. Add a deterministic regression check using synthetic or approved fixtures.
6. Update the error record with fix, check, prevention rule, and verification status.
7. If it happened before, explain why the prior rule/check failed and strengthen it.

## Required fields
ID, detection date, affected version, symptom, reproduction conditions, root cause, affected file/module, fix, regression check, prevention rule, and status.

## Acceptance
Do not mark resolved without reproduction or a reason reproduction is blocked. Never attach user audio without permission. Report the checks actually run.
