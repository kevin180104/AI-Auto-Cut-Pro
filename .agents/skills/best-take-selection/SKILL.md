---
name: best-take-selection
description: Group repeated sentences/phrases and rank candidate takes for spoken-word editing. Use for AI Auto Cut Pro retake detection, duplicate grouping, and take selection.
---

# Best Take Selection

## Workflow
1. Group candidates using transcript similarity, script order, speaker identity, acoustic continuity, and context.
2. Preserve original order and source ranges; never infer that the last take is preferred.
3. Rank with evidence such as script fidelity, completeness, articulation, clipping/noise, loudness, and room tone.
4. Penalize missing words and protect names/numbers; do not rank a smoother but incorrect take above a faithful one.
5. Return ranked candidates with evidence/confidence. Send close or contradictory cases to human review.
6. Keep selection separate from rendering so a person can change it without reanalysis.

## Safety
Use local ASR/alignment and acoustic measurements. Never synthesize missing speech or silently rewrite the script.

## Acceptance and validation scenarios
- Include phrases read twice and three times; include a best take that is not last.
- Include an incomplete take, a correct take with a stumble, and intentional repeated wording.
- Verify selected ranges are within the source and every alternative remains reviewable.
- Explain feature contributions and unresolved uncertainty.
