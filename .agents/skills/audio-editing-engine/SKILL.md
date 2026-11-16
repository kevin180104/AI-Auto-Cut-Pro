---
name: audio-editing-engine
description: Implement AI Auto Cut Pro's sample-accurate EDL, safe cuts, joins, fades, loudness handling, and WAV/MP3 rendering. Use whenever changing audio editing or rendering behavior.
---

# Audio Editing Engine

## Workflow
1. Validate container/codec, sample rate, channels, duration, and input/output paths.
2. Keep source media immutable; render to a new file using an explicit EDL.
3. Express time in integer samples or a rational time base. Validate ranges and monotonicity before rendering.
4. Use acoustic boundary checks and safety margins; never cut directly at ASR timestamps.
5. Apply joins/fades only when boundaries and room tone support them. Keep automated edits reversible.
6. Store source hash, source/output ranges, reason, confidence, and software/model versions in the EDL.
7. Reopen the output and validate duration, stream parameters, clipping, discontinuities, and content continuity.

## Allowed tools and safety
Use approved local media libraries/FFmpeg after its path and version are verified. Never overwrite inputs or write into a source directory without an explicit output path.

## Acceptance and validation scenarios
- Test exact sample mapping for trims, concatenation, fades, and invalid ranges.
- Include a plosive/consonant onset and verify the initial phoneme remains.
- Test empty EDL, overlap, out-of-bounds ranges, multi-channel audio, and interrupted-render cleanup.
- Reopen rendered WAV/MP3 and compare expected duration and EDL-derived content.
