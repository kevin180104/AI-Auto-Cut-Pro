# Sprint 5 — Evidence, calibration and local editing

Sprint 4 constructed a single keep-all segment. Sprint 5 builds EDL ranges from the decision engine. The renderer accepts a separate auto-approved record with the rule, source hash and calibration provenance, then independently rejects any automatic cut if a sample in the cut or either 200 ms guard is nonzero. Human EDLs still follow the existing path.

The only executable automatic rule is digital-silence-v1. It requires an interior Silero pause, exact digital silence on all channels and no overlap with padded ASR words or VAD. At least 400 ms of the pause remains. Nonzero room tone, boundary pauses and potential breaths remain intact. The rule creates zero-to-zero joins and does not need crossfade. For proposed auto cuts, an independently transcribed trial must retain the ASR word sequence and avoid a peak increase. A failed trial restores all candidate cuts before publishing. ASR agreement is one check and listening is still independent.

Retake evidence uses ordered token alignment across nearby segments, gap length, speech overlap, per-take signal measurements and optional script coverage. It distinguishes possible incomplete restarts from longer shared context and records apparent repetitions with unknown intent. This release has no validated semantic similarity model, pronunciation scorer or reliable intent detector. These gaps keep speech candidates out of automatic removal. Name and number signals are conservative, and all other speech candidates are retained as well.

## Run

Set AACP_ASR_PYTHON and AACP_ASR_MODEL as described in SPRINT4.md. Set AACP_FFMPEG if needed.

    node scripts/auto-edit.mjs input.wav --output work/new-run --shadow

Use a fresh local output directory under work. Input is PCM16 or float32 mono/stereo WAV. The raw path runs local Silero and Vietnamese ASR and emits WAV, MP3, EDL and decision reports. For real-01, --prepared work/acceptance/real-01 can reuse hash-verified prior Silero and ASR data. --script accepts an optional UTF-8 file with one line per comparison unit. No model, audio or transcript is uploaded by this command.

## Calibration and evaluation

No deployment calibration is shipped. The gate reads a trusted local JSON attestation with rule digital-silence-v1, id, independent=true, domain vietnamese-broadcast and cases containing sourceHash, selected and safe. It rejects source leakage, fewer than 100 selected windows from 10 distinct recordings, any selected unsafe window or a set without a negative case. These minimum gates are provisional operational requirements, not a statistical certification. A synthetic attestation is used only to exercise the nonzero path in regression tests.

Before activation, use licensed, independently annotated Vietnamese recordings disjoint from development and evaluation sources. Mark retake identity, intentional repetitions, incompleteness, protected wording and approved removal ranges. Replay the frozen candidate algorithm and measure retake precision/recall, cut precision and unsafe deletions per selected cut, with counts by recording and an uncertainty interval accounting for shared recordings. Listen to accepted joins and inspect word and phoneme boundaries. Include quiet speech, breaths, silence and production noise as negative examples. No labeled independent benchmark was supplied, so real-audio precision, recall and false-deletion rate are not measured.


## Sprint 5 validation

The raw-file CLI ran on a locally synthesized speech WAV with no prepared review data. Silero, both ASR passes, WAV/EDL publication and real FFmpeg MP3 export completed. The output preserved all 301,582 source frames in shadow mode. Separate automated PCM16 and float32 fixtures exercised a 12,800-frame automatic cut using synthetic calibration, verified retained bytes and rejected a nonzero sample in the cut.

For real-01, the updated detector encountered 41 candidate pairs, including all 27 from Sprint 4. It retained 24 as uncertain and 17 as protected. Of 140 pause proposals, 114 intersected protected ASR or VAD evidence and 26 remained uncertain. There were no physically eligible pause cuts. A local comparison table and per-candidate decisions are stored in the ignored run directory.

The benchmark scorer accepts the local run report, its EDL and independently produced labels containing sourceHash, retakes (pairs of frame intervals) and safeRanges. It matches pairs by exact frame coordinates, and checks that a cut fits entirely in a safe range. Zero selected cuts produces a null false-deletion rate. The synthetic score regression checks false positives, missed positives and a cut that exceeds its labeled boundary. This strict frame match is a reproducible diagnostic and may count a near-boundary match as both a miss and a false positive.

Real-01 completed through publication. The WAV contains all 107,064,320 source frames and has the same whole-file hash as the earlier reference WAV. The decoded 192 kbps MP3 has the same frame count. The original recording hash is unchanged. The independent output ASR returned 370 segments versus 361 in the reused source transcript, and the word sequences differ even though the reference WAV and output WAV have identical bytes. The cause was not isolated. This is an ASR reproducibility limitation and is not evidence of a deletion. Zero joins were introduced. The WAV still contains the 1,368 source samples at or above full scale. Listening remains untested.

Final local checks: 53 Node tests, 6 Python tests and 8 skill checks passed.
