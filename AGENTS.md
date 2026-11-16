# AI Auto Cut Pro — project instructions

## Mission

Build a Windows-first, Vietnamese-first assistant for reviewing and editing spoken-word recordings. Preserve the original recording and make every proposed edit traceable to an EDL.

## Safety invariants

- Never overwrite or delete source audio.
- Never remove speech solely because ASR confidence is low or timestamps identify a word boundary.
- Compare against a user-provided script when available; preserve numbers, dates, names, legal text, and political content exactly.
- Keep uncertain edits in a review queue. Do not synthesize missing speech or silently rewrite a script.
- Keep audio local by default. Do not upload audio or scripts to cloud services without the user's explicit authorization for that data and destination.
- Record the evidence and confidence for each edit and retain reversible source ranges in the EDL.
- Distinguish documented support, a mock, an untested implementation, and a successful real Audition test.

## Engineering workflow

1. Read the relevant project skill under `.agents/skills/` and the applicable rules under `.ai/` before changing a subsystem.
2. Inspect existing code and Git status before editing. Work on a feature branch; never overwrite unrelated user changes.
3. Prefer small modules with explicit inputs/outputs. Keep audio analysis, edit decisions, rendering, and host integration replaceable.
4. Add or update regression coverage for every fixed defect. Run only the checks relevant to changed code and report their actual result.
5. Update `.ai/ERROR_MEMORY.md` when a real defect is diagnosed; include a regression check and prevention rule.
6. Do not claim Audition compatibility until a real build has been exercised in the named Audition version.

## Current status

Phase 1 findings and unverified items are in `docs/PHASE1_REPORT.md`. This workspace was empty and had no remote when work began. A GitHub repository is not yet available; do not publish or push until a repository URL exists.
