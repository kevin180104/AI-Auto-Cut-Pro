import { win32 } from 'node:path';

const isInteger = Number.isSafeInteger;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateRange(segment, totalSamples, label) {
  assert(segment && typeof segment === 'object', `${label} must be an object`);
  assert(isInteger(segment.sourceStartSample), `${label}.sourceStartSample must be a safe integer`);
  assert(isInteger(segment.sourceEndSample), `${label}.sourceEndSample must be a safe integer`);
  assert(segment.sourceStartSample >= 0, `${label}.sourceStartSample must be non-negative`);
  assert(segment.sourceEndSample > segment.sourceStartSample, `${label} must use a non-empty half-open range`);
  assert(segment.sourceEndSample <= totalSamples, `${label} exceeds source length`);
}

function ensureSortedNonOverlapping(segments, label) {
  for (let i = 1; i < segments.length; i += 1) {
    assert(
      segments[i - 1].sourceEndSample <= segments[i].sourceStartSample,
      `${label} must be sorted and non-overlapping`,
    );
  }
}

function pathsReferToSameFile(sourcePath, outputPath) {
  const normalize = (value) => win32.resolve(value).toLowerCase();
  return normalize(sourcePath) === normalize(outputPath);
}

/**
 * Validate the safety-critical shape of an EDL v1 document.
 * All ranges are half-open [start, end) sample indexes.
 * Removed source ranges require explicit human approval until a measured
 * automatic-deletion policy is introduced.
 */
export function validateEdl(edl) {
  assert(edl && typeof edl === 'object', 'EDL must be an object');
  assert(edl.version === 1, 'EDL version must be 1');
  assert(edl.source && typeof edl.source.path === 'string' && edl.source.path.length > 0, 'source.path is required');
  assert(edl.output && typeof edl.output.path === 'string' && edl.output.path.length > 0, 'output.path is required');
  assert(!pathsReferToSameFile(edl.source.path, edl.output.path), 'output path must differ from source path');
  assert(/^[a-f\d]{64}$/i.test(edl.source.sha256 ?? ''), 'source.sha256 must be a 64-character SHA-256 hex digest');
  assert(isInteger(edl.source.sampleRate) && edl.source.sampleRate > 0, 'source.sampleRate must be a positive integer');
  assert(isInteger(edl.source.channels) && edl.source.channels > 0, 'source.channels must be a positive integer');
  assert(isInteger(edl.source.totalSamples) && edl.source.totalSamples > 0, 'source.totalSamples must be a positive integer');
  assert(Array.isArray(edl.keepSegments) && edl.keepSegments.length > 0, 'EDL must retain at least one source segment');
  assert(Array.isArray(edl.removedSegments), 'removedSegments must be an array');

  for (const [index, segment] of edl.keepSegments.entries()) {
    validateRange(segment, edl.source.totalSamples, `keepSegments[${index}]`);
    assert(typeof segment.id === 'string' && segment.id.trim().length > 0, 'keep segment id is required');
  }
  ensureSortedNonOverlapping(edl.keepSegments, 'keepSegments');

  for (const [index, segment] of edl.removedSegments.entries()) {
    const label = `removedSegments[${index}]`;
    validateRange(segment, edl.source.totalSamples, label);
    assert(segment.approval === 'human-approved', `${label} requires explicit human approval`);
    assert(typeof segment.reason === 'string' && segment.reason.trim().length > 0, `${label}.reason is required`);
    assert(typeof segment.evidence === 'string' && segment.evidence.trim().length > 0, `${label}.evidence is required`);
    assert(typeof segment.id === 'string' && segment.id.trim().length > 0, `${label}.id is required`);
  }

  const allRanges = [
    ...edl.keepSegments.map((segment) => ({ ...segment, kind: 'keep' })),
    ...edl.removedSegments.map((segment) => ({ ...segment, kind: 'remove' })),
  ].sort((left, right) => left.sourceStartSample - right.sourceStartSample);

  assert(allRanges[0].sourceStartSample === 0, 'EDL must account for the source from sample 0');
  for (let i = 1; i < allRanges.length; i += 1) {
    assert(
      allRanges[i - 1].sourceEndSample === allRanges[i].sourceStartSample,
      'keep and removed ranges must account for every source sample exactly once',
    );
  }
  assert(allRanges.at(-1).sourceEndSample === edl.source.totalSamples, 'EDL must account for the end of the source');
  return true;
}

/** Build a deterministic source-to-output sample map for retained segments. */
export function buildOutputMap(edl) {
  validateEdl(edl);
  let outputSample = 0;
  return edl.keepSegments.map((segment) => {
    const length = segment.sourceEndSample - segment.sourceStartSample;
    const mapped = {
      id: segment.id,
      sourceStartSample: segment.sourceStartSample,
      sourceEndSample: segment.sourceEndSample,
      outputStartSample: outputSample,
      outputEndSample: outputSample + length,
    };
    outputSample += length;
    return mapped;
  });
}
