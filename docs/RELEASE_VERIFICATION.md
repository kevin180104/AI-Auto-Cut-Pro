# Release verification

## Local Vietnamese benchmark

Keep the manifest, labels and runs under the ignored work directory. Use material licensed for this purpose. Assign whole recordings to development, calibration or acceptance before tuning. Label both true retakes and their boundaries, plus interior ranges whose removal is acceptable. Review repetitions, low-level speech, breaths, names, numbers and legal wording. Have an independent reviewer check the annotation scope.

A version 1 manifest contains recordings with split, authorized, independent, reviewer (use a local pseudonym), report, edl and labels. The last three are paths relative to the manifest. A label file contains sourceHash, annotationComplete, retakes (pairs of half-open startFrame/endFrame ranges for each true retake) and safeRanges (half-open ranges). Set annotationComplete only after the full recording has been assessed against the benchmark protocol.

    node scripts/evaluate-corpus.mjs work/benchmark/manifest.json

The scorer rejects repeated file hashes across splits, incomplete labeling and out-of-bounds labels. Identify near duplicates and re-encoded copies independently before splitting. The report keeps development, calibration and acceptance counts separate. A null rate means there was no denominator. This tool does not activate a calibration, and exact-frame retake matching is a strict diagnostic.

## ASR audit

The local adapter records the input WAV hash, decoded PCM hash, model-file hashes, decoder version fingerprint and inference settings/runtime. Run it twice against the same recording and compare the two local result files:

    node scripts/compare-asr.mjs work/first.json work/second.json

The comparator prints structural flags and segment counts without exposing recognized text. New trials must use the same recorded ASR execution profile before automatic editing can publish a cut. A legacy transcript is still usable for shadow analysis, but its missing execution profile cannot authorize a cut. A matching transcript does not establish human listening quality.

## Release gates

- Benchmark: independent authorized Vietnamese labels needed. No real false-deletion rate is available yet.
- Audio: compare the preserved PCM, EDL and splice boundaries, then have a reviewer listen to actual edited speech and confirm important content.
- Windows workflow: unify raw input, analysis, review and resumable export in Studio. Test the installed package on a clean machine.
- Audition: test import of an approved disposable render into a real Multitrack session and document observed version and results. CEP timeline control remains unverified.

## Verification on 2026-11-17

Before fixing decoding temperature, repeated runs on the same synthetic WAV differed in words despite matching WAV, decoded PCM and execution profile. The dependency defaults to temperature fallback with sampling on difficult windows. After setting temperature explicitly to zero, two runs matched on the same synthetic WAV and on a 30-second authorized real-01 excerpt. This does not isolate all causes of the historical full-recording mismatch or establish accuracy. The full recording and independent labeled evaluation remain outstanding.

The local Node suite passed all 56 tests, with Windows FFmpeg enabled. GitHub CI now includes a Windows job for the Node suite and backend Python checks, in addition to the existing Ubuntu job. The Windows CI job does not install FFmpeg or run Adobe Audition.

## Open a new recording in Studio

Run the local environment setup in SPRINT4.md, then use a new ignored destination for each run. The shadow run creates WAV/MP3 and EDL plus a Studio session with local before/after previews. Human review exports into the session folder and preserves the original recording.

    node scripts/auto-edit.mjs "input.wav" --output work/new-session --shadow --studio
    npm.cmd run studio -- work/new-session/studio-session

Open the loopback URL printed by Studio. If an existing Studio is still using the default port, set AACP_PORT in the new terminal to an unused loopback port. An existing real-01 session remains usable with the original command.
