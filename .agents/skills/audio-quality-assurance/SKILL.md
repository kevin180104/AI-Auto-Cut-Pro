---
name: audio-quality-assurance
description: Define and run objective and listening-based checks on AI Auto Cut Pro edits and exports. Use when reviewing renders, editing thresholds, or reporting audio quality.
---

# Audio Quality Assurance

## Workflow
1. Validate container/codec, sample rate, channels, duration, peak, loudness, and finite sample values.
2. Inspect each EDL join for clicks, discontinuities, truncated phonemes, room-tone jumps, and clipping.
3. Compare transcript/script coverage before and after rendering; verify protected numbers and names.
4. Check for unintended repetitions or omissions, long gaps, abrupt breaths, and channel changes.
5. Use listening review for perceptual quality; objective thresholds alone cannot establish naturalness.
6. Report each check as PASS, FAIL, NOT TESTED, or BLOCKED with tool/version and limits.

## Allowed tools and safety
Use local source and rendered audio selected by the user. Do not upload samples or log speech content.

## Acceptance and validation scenarios
- Include silence, clipping, unequal loudness, noise, long pause, bad join, and deliberate repeated speech.
- Verify a correct intentional repetition is not removed.
- Ensure each quality failure identifies its exact EDL range.
