import { createHash } from 'node:crypto';
import { parseWavBuffer } from '../audio-engine/wav.js';
import { validateEdl } from '../audio-engine/edl.js';

// Energy detector, not a speech classifier: weak speech may be labelled quiet.
export function analyzeActivity(buffer, { threshold = 0.01, windowMs = 20, marginMs = 200, minQuietMs = 1000 } = {}) {
  const wav = parseWavBuffer(buffer);
  if (wav.formatTag !== 1 || wav.bitsPerSample !== 16 || ![1, 2].includes(wav.channels)) throw new Error('Activity analysis currently supports PCM16 mono/stereo WAV only');
  if (!wav.sampleFrames || !Number.isFinite(threshold) || threshold <= 0 || threshold >= 1 || !Number.isFinite(windowMs) || windowMs <= 0 || !Number.isFinite(marginMs) || marginMs < 0 || !Number.isFinite(minQuietMs) || minQuietMs <= 0) throw new Error('Invalid analysis input or settings');
  const step = Math.max(1, Math.round(wav.sampleRate * windowMs / 1000));
  const margin = Math.ceil(wav.sampleRate * marginMs / 1000);
  const active = [];
  for (let start = 0; start < wav.sampleFrames; start += step) {
    const end = Math.min(start + step, wav.sampleFrames);
    let peak = 0;
    for (let frame = start; frame < end; frame++) for (let channel = 0; channel < wav.channels; channel++) {
      peak = Math.max(peak, Math.abs(buffer.readInt16LE(wav.dataOffset + frame * wav.blockAlign + channel * 2)) / 32768);
    }
    if (peak >= threshold) {
      const a = Math.max(0, start - margin), b = Math.min(wav.sampleFrames, end + margin);
      const previous = active.at(-1);
      if (previous && previous.endFrame >= a) previous.endFrame = Math.max(previous.endFrame, b);
      else active.push({ startFrame: a, endFrame: b });
    }
  }
  return proposalsFromActive(wav, buffer, active, { threshold, windowMs, marginMs, minQuietMs }, 'peak-energy-v1');
}

export function proposalsFromActive(wav, buffer, active, settings, detector) {
  const { minQuietMs } = settings;
  let last = 0;
  for (const r of active) { if (!Number.isSafeInteger(r.startFrame) || !Number.isSafeInteger(r.endFrame) || r.startFrame < last || r.endFrame <= r.startFrame || r.endFrame > wav.sampleFrames) throw new Error('Invalid activity ranges'); last = r.endFrame; }
  const quiet = []; let cursor = 0;
  for (const segment of active) { if (cursor < segment.startFrame) quiet.push({ startFrame: cursor, endFrame: segment.startFrame }); cursor = segment.endFrame; }
  if (cursor < wav.sampleFrames) quiet.push({ startFrame: cursor, endFrame: wav.sampleFrames });
  // All-quiet input can contain quiet speech: never propose deleting the whole file.
  const proposals = active.length ? quiet.filter(s => s.endFrame - s.startFrame >= Math.ceil(wav.sampleRate * minQuietMs / 1000)).map((s, i) => ({
    id: `quiet-${i + 1}`, ...s, startSeconds: s.startFrame / wav.sampleRate, endSeconds: s.endFrame / wav.sampleRate,
    reason: `Potential quiet region (${detector}); requires listening and explicit approval`, status: 'pending',
  })) : [];
  return { source: { sha256: createHash('sha256').update(buffer).digest('hex'), sampleRate: wav.sampleRate, channels: wav.channels, totalSamples: wav.sampleFrames }, active, quiet, proposals, settings, detector };
}

export function approvedEdl(analysis, approvedIds, sourcePath, outputPath) {
  if (!Array.isArray(approvedIds) || new Set(approvedIds).size !== approvedIds.length) throw new Error('Invalid approvals');
  const selected = analysis.proposals.filter(p => approvedIds.includes(p.id));
  if (selected.length !== approvedIds.length) throw new Error('Unknown proposal');
  const removedSegments = selected.map(p => ({ id: p.id, sourceStartSample: p.startFrame, sourceEndSample: p.endFrame, approval: 'human-approved', reason: p.reason, evidence: `User approved ${p.id}; detector ${analysis.detector}` }));
  const keepSegments = []; let cursor = 0;
  for (const p of removedSegments) { if (cursor < p.sourceStartSample) keepSegments.push({ id: `keep-${keepSegments.length + 1}`, sourceStartSample: cursor, sourceEndSample: p.sourceStartSample }); cursor = p.sourceEndSample; }
  if (cursor < analysis.source.totalSamples) keepSegments.push({ id: `keep-${keepSegments.length + 1}`, sourceStartSample: cursor, sourceEndSample: analysis.source.totalSamples });
  const edl = { version: 1, source: { path: sourcePath, ...analysis.source }, output: { path: outputPath }, keepSegments, removedSegments, analysis: { detector: analysis.detector, settings: analysis.settings } };
  validateEdl(edl); return edl;
}
