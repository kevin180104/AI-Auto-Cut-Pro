---
name: vietnamese-script-alignment
description: Align Vietnamese speech transcripts with TXT/DOCX scripts while preserving diacritics, names, figures, dates, and legal wording. Use when implementing AI Auto Cut Pro script comparison or alignment.
---

# Vietnamese Script Alignment

## Workflow
1. Parse TXT/DOCX without rewriting; preserve original text and paragraph/line locations.
2. Normalize only for matching (Unicode, spacing, punctuation). Keep original wording for display/export.
3. Align transcript spans to script tokens with alternatives, sample-accurate audio ranges, and alignment confidence.
4. Protect diacritics, proper names, administrative entities, place names, amounts, dates, document IDs, and legal/political content.
5. Surface omissions, substitutions, insertions, and uncertain alignment separately. Never ask an LLM to create missing spoken words.
6. Route dialect forms, homophones, and low-confidence spans to human review.

## Allowed tools
Use local document parsers and replaceable ASR/aligner adapters. Do not upload scripts or recordings without explicit approval naming the provider and data.

## Acceptance and validation scenarios
- Test Vietnamese diacritics and Unicode normalization.
- Include `06-NQ/ĐU`, `Ủy ban nhân dân phường Chiềng Cơi`, dates, and spoken amounts.
- Verify source wording is unchanged after alignment and serialization.
- Verify uncertain tokens are flagged rather than silently corrected.
