# Sprint 4 — Local broadcast analysis

The local Vietnamese ASR adapter uses multilingual faster-whisper Base on CPU INT8. The tested workstation has a Xeon E5-1620 v4 with eight logical processors and a Quadro M2000 with 4 GiB. CPU avoids dependence on unverified CUDA libraries. Download model weights separately. Inference loads local files in offline mode, and FFmpeg decodes the WAV to mono float32 at 16 kHz.

The pipeline binds ASR to the local reference file, checks that the reference audio samples match the original and verifies the original SHA-256 at publication. It combines earlier Silero pause proposals with word timestamps and identifies adjacent repeated prefixes. Ranking favors completeness proxies and then mean ASR score, with an explicit ambiguity record. Capitalization and digits are protective signals, not an exhaustive detector for names or legal references. The heuristics do not establish pronunciation accuracy, intentionality or ground truth. No deletion policy is calibrated. The 85% target is not applied to uncalibrated ASR scores. The pipeline exports a keep-all EDL, verified WAV and 192 kbps MP3 and reruns local ASR on the result. No joins, gain changes or fades are needed in the keep-all path.

## Run locally

Install speech-analysis/requirements-asr.txt in the project virtual environment. Download Systran/faster-whisper-base weights to an ignored local directory with huggingface_hub.snapshot_download. In PowerShell:

    $env:AACP_ASR_PYTHON = (Resolve-Path .venv/Scripts/python.exe).Path
    $env:AACP_ASR_MODEL = (Resolve-Path work/models/faster-whisper-base).Path
    node scripts/auto-edit.mjs work/acceptance/real-01

Use a fresh sprint4 output directory for each full run. Outputs, words, cut candidates and timecodes stay in ignored local storage. Set AACP_FFMPEG if FFmpeg is installed elsewhere.

## Validation scope

Local regression: 48 Node and 6 Python tests passed. Seven classification cases exercise conservative classification with synthetic timestamped transcripts, including incomplete reads, stumbles, repetition, protected names/numbers and quiet or long pauses. Existing audio tests cover preserved frame boundaries and synthetic joins. Human listening, Vietnamese ground truth, word error rate, semantic retake accuracy and readiness for broadcast remain unverified.

## Real-01 run

The authorized local recording ran end to end for 107,064,320 source frames at 48 kHz mono. The source SHA-256 remained unchanged. Whisper produced 361 segments and 6,133 word timestamp entries. Evidence comprised 140 VAD proposals and 27 repeated-prefix candidates. The policy retained 129 protected and 38 uncertain findings and cut zero regions.

The float WAV preserved all sample bytes. The 192 kbps MP3 decoded to the same frame count and stream format. The second ASR run returned the same 361 segments with identical text and timestamps. This corroborates the keep-all run but does not certify ASR accuracy or audio quality. The WAV contains 1,368 samples at or above full scale, already present in the source. Listening and splice acceptance were not performed. The five deliverables and two private transcripts were written to the ignored local Sprint 4 directory.

The pipeline currently consumes a prepared review dataset (reference WAV, source EDL and Silero review JSON). Raw-file-only ingestion, a calibrated AUTO deletion policy and validated retake/phoneme accuracy remain incomplete.
