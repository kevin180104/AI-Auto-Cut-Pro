import { renderWavBuffer } from '../audio-engine/wav.js';

/** Produce bounded before/after previews using the original immutable source bytes. */
export function makePreview(source, analysis, proposal, contextSeconds = 1) {
  if (!Number.isFinite(contextSeconds) || contextSeconds <= 0) throw new Error('Invalid preview context');
  const start = Math.max(0, proposal.startFrame - Math.ceil(contextSeconds * analysis.source.sampleRate));
  const end = Math.min(analysis.source.totalSamples, proposal.endFrame + Math.ceil(contextSeconds * analysis.source.sampleRate));
  const make = (removeProposal) => {
    const remove = [];
    const add = (a, b, id) => { if (a < b) remove.push({ id, sourceStartSample: a, sourceEndSample: b, approval: 'human-approved', reason: 'Temporary preview only', evidence: 'Preview context extraction; not an edit decision' }); };
    add(0, start, 'outside-before'); if (removeProposal) add(proposal.startFrame, proposal.endFrame, 'preview-removal'); add(end, analysis.source.totalSamples, 'outside-after');
    let cursor = 0; const keep = [];
    for (const r of remove) { if (cursor < r.sourceStartSample) keep.push({ id: `keep-${keep.length}`, sourceStartSample: cursor, sourceEndSample: r.sourceStartSample }); cursor = r.sourceEndSample; }
    if (cursor < analysis.source.totalSamples) keep.push({ id: `keep-${keep.length}`, sourceStartSample: cursor, sourceEndSample: analysis.source.totalSamples });
    if (!keep.length) throw new Error('Preview would contain no audio');
    return renderWavBuffer(source, { version: 1, source: { ...analysis.source, path: 'preview-source.wav' }, output: { path: 'preview-result.wav' }, keepSegments: keep, removedSegments: remove }).buffer;
  };
  return { before: make(false), after: make(true), startFrame: start, endFrame: end };
}
