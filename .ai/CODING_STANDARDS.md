# Coding Standards

- Use explicit, typed data contracts at subsystem boundaries.
- Store audio time as integer samples or rational time bases; avoid floating-point accumulation for edit boundaries.
- Validate sample rate, channel count, duration, and file format before analysis.
- Never use an input path as an output path; make writes atomic where practical.
- Record model/config versions for model-based decisions.
- Keep UI, orchestration, ASR, alignment, edit decisions, rendering, and host adapters replaceable.
- Exclude audio content, credentials, and personal data from logs.
- Add regression coverage for each diagnosed defect.
