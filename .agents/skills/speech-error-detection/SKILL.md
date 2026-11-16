---
name: speech-error-detection
description: Design or change detection of read mistakes, stumbles, abandoned phrases, long pauses, breaths, clipping, and speech anomalies. Use when implementing or reviewing AI Auto Cut Pro error detection.
---

# Speech Error Detection

## Workflow
1. Define each error class and observable evidence needed to flag it.
2. Keep acoustic evidence separate from ASR/script evidence; align timestamps to samples before proposing edits.
3. Compare against a user script when present and protect numbers, names, dates, legal references, and Vietnamese diacritics.
4. Represent findings with source range, category, confidence, evidence, and review status.
5. Calibrate thresholds on licensed, representative Vietnamese recordings; report false positives/negatives by class and dialect.
6. When confidence is insufficient, request review; never delete speech based only on ASR uncertainty.

## Allowed tools and safety
Use approved local audio fixtures, versioned ASR/VAD/alignment adapters, and deterministic signal measures. Keep cloud inference off unless the user approves the specific audio and provider.

## Acceptance and validation scenarios
- Distinguish read errors from intentional pauses and expressive delivery.
- Include a correct sentence, misread-then-repeat, mid-sentence stumble, long pause, clipping, and noisy segment.
- Cover Vietnamese numbers, names, places, and regional pronunciations; represent uncertainty honestly.
- Preserve each finding's source range and report dataset limits; do not present synthetic cases as real-world accuracy.
