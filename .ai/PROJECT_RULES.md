# Project Rules

1. Preserve original audio and script; write derived media to a separate output path.
2. Prefer an offline pipeline. Make network use visible and opt-in.
3. Model scores are evidence, not permission to delete speech.
4. Send ambiguous words, numbers, names, and boundaries to human review.
5. Require EDL provenance for every edit: source hash, source/output ranges, reason, confidence, and engine/version.
6. Reopen and validate rendered output before calling an export complete.
7. Mark checks PASS, FAIL, NOT TESTED, or BLOCKED. Code existing is not PASS.
8. Treat Audition support as version-specific and verify against the actual host.
