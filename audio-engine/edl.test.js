import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOutputMap, validateEdl } from './edl.js';

const baseEdl = () => ({
  version: 1,
  source: {
    path: 'C:\\audio\\source.wav',
    sha256: 'a'.repeat(64),
    sampleRate: 48000,
    channels: 1,
    totalSamples: 1000,
  },
  output: { path: 'C:\\audio\\edited.wav' },
  keepSegments: [
    { id: 'keep-1', sourceStartSample: 0, sourceEndSample: 400 },
    { id: 'keep-2', sourceStartSample: 600, sourceEndSample: 1000 },
  ],
  removedSegments: [
    {
      id: 'remove-1',
      sourceStartSample: 400,
      sourceEndSample: 600,
      approval: 'human-approved',
      reason: 'Retake approved for removal',
      evidence: 'Reviewer selected keep-2 for this phrase',
    },
  ],
});

test('accepts a complete sample-accurate EDL', () => {
  assert.equal(validateEdl(baseEdl()), true);
});

test('rejects an output path that would overwrite source audio', () => {
  const edl = baseEdl();
  edl.output.path = 'c:/AUDIO/source.wav';
  assert.throws(() => validateEdl(edl), /output path must differ/i);
});

test('rejects removed speech without human approval', () => {
  const edl = baseEdl();
  edl.removedSegments[0].approval = 'automatic';
  assert.throws(() => validateEdl(edl), /explicit human approval/i);
});

test('rejects gaps, overlaps, and out-of-range sample boundaries', () => {
  const gap = baseEdl();
  gap.removedSegments[0].sourceStartSample = 450;
  assert.throws(() => validateEdl(gap), /account for every source sample/i);

  const overlap = baseEdl();
  overlap.keepSegments[1].sourceStartSample = 390;
  assert.throws(() => validateEdl(overlap), /sorted and non-overlapping/i);

  const outOfRange = baseEdl();
  outOfRange.keepSegments[1].sourceEndSample = 1001;
  assert.throws(() => validateEdl(outOfRange), /exceeds source length/i);
});

test('maps retained source ranges to contiguous output sample ranges', () => {
  const mapped = buildOutputMap(baseEdl());
  assert.deepEqual(mapped.map(({ sourceStartSample, sourceEndSample, outputStartSample, outputEndSample }) => ({
    sourceStartSample, sourceEndSample, outputStartSample, outputEndSample,
  })), [
    { sourceStartSample: 0, sourceEndSample: 400, outputStartSample: 0, outputEndSample: 400 },
    { sourceStartSample: 600, sourceEndSample: 1000, outputStartSample: 400, outputEndSample: 800 },
  ]);
});

test('rejects an EDL that removes the entire recording', () => {
  const edl = baseEdl();
  edl.keepSegments = [];
  assert.throws(() => validateEdl(edl), /retain at least one/i);
});

test('rejects a source overwrite through path normalization', () => {
  const edl = baseEdl();
  edl.output.path = 'C:\\audio\\..\\audio\\source.wav';
  assert.throws(() => validateEdl(edl), /output path must differ/i);
});
