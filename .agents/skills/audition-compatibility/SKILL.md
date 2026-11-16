---
name: audition-compatibility
description: Investigate Adobe Audition SDK, CEP/ExtendScript, session interchange, version compatibility, and automation limits. Use when implementing or making compatibility claims for AI Auto Cut Pro's Audition integration.
---

# Audition Compatibility

## Workflow
1. Record exact Audition product/file version, OS, SDK version, and extension runtime.
2. Read current Adobe Audition documentation and SDK materials; do not substitute Premiere Pro documentation.
3. Separate documented capability from observed behavior. Documentation does not prove a needed edit workflow is supported.
4. Define the narrow integration contract: file handoff, panel communication, markers/session exchange, preview, or an actual edit operation.
5. Build the smallest reversible POC against a disposable session. Preserve source media and a backup.
6. Log the action, host/runtime, expected and observed results, and failure mode.
7. Keep unsupported operations in the standalone engine or manual-review workflow; never depend on GUI automation alone.

## Allowed tools and safety
Use official Adobe docs/SDKs, local code, and approved desktop automation. Do not install extensions or change Audition settings without authorization. Do not modify user sessions in a POC.

## Acceptance and validation scenarios
- Mark mocks and documentation-only findings NOT TESTED.
- Claim version support only after a real-host test on that version.
- On a disposable session, verify the panel identifies host/version and exchanges one non-destructive metadata/marker item that persists after reopen.
- Test reversible editing only if the SDK exposes it; verify undo and source preservation.
- Repeat each claimed scenario on every supported Audition major version.
- Report exact versions, actions, results, limits, and standalone fallback.
