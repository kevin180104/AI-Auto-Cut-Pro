# Compatibility Rules

- COMPAT-001: Do not assume Premiere Pro APIs apply to Audition.
- COMPAT-002: Documented capability is not proof this application works with it; keep real-host POCs separate.
- COMPAT-003: Label mocks as mocks; never report them as Audition tests.
- COMPAT-004: Claim support only for Audition versions actually tested.
- COMPAT-005: Keep analysis/rendering usable without Audition.
- COMPAT-006: Do not make unstable GUI automation the only integration path.
- COMPAT-007: Recheck after any Audition host or SDK change.
- COMPAT-008: Record SDK, host, OS, and exact tested action for each compatibility result.
- COMPAT-009: Classify each integration behavior as SUPPORTED, LIMITED, UNSUPPORTED, or UNVERIFIED; cite the runtime evidence and do not promote documentation to runtime proof.
- COMPAT-010: Audition 26.0.0.56 was observed opening its bundled Adobe Audition Portal panel and a synthetic WAV. This does not verify custom CEP deployment, ExtendScript execution, backend exchange, session metadata APIs, or timeline editing APIs.
- COMPAT-011: Treat file export/open as a limited manual handoff until a complete export-process-reimport workflow has been demonstrated in a disposable session.
- COMPAT-012: Do not install a CEP extension, change Audition preferences, or test destructive edits in a user session without explicit authorization and a disposable fixture.
- COMPAT-013: The installed Audition Portal manifest reports host ID `AUDT`, host version `11.0`, CSXS `6.0`; use this local evidence for the POC and revalidate against the exact target SDK before distribution.
- COMPAT-014: A custom CEP package that has not been installed and launched in Audition is UNVERIFIED even when the bundled Portal works.
- COMPAT-015: Do not change CEP debug/trust settings or install an unsigned extension without separate authorization. Source-level checks do not count as runtime verification.
- COMPAT-016: A loopback backend source check is not a backend runtime round trip; require Python execution and an observed response before claiming support.
- COMPAT-017: A failed PATH lookup does not establish that Python is absent system-wide; record locations searched and the interpreter actually used.
