import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, validateAdapter, validateRange, createReviewFinding } from './contracts.js';

test('all six independent analysis adapters require identity and an analysis function', () => {
  for (const stage of STAGES) assert.equal(validateAdapter(stage, { id: 'mock', version: '1', analyze() {} }).id, 'mock');
  assert.throws(() => validateAdapter('asr', { id: 'mock', version: '1' }));
  assert.throws(() => validateAdapter('unknown', { id: 'mock', version: '1', analyze() {} }));
});
test('analysis ranges use bounded integer source frames', () => {
  assert.equal(validateRange({ startFrame: 0, endFrame: 10 }, 10), true);
  for (const range of [{ startFrame: -1, endFrame: 1 }, { startFrame: 2, endFrame: 2 }, { startFrame: 0, endFrame: 11 }, { startFrame: 0.5, endFrame: 2 }]) assert.throws(() => validateRange(range, 10));
});
test('findings remain review-only regardless of confidence', () => {
  const finding = createReviewFinding({ range: { startFrame: 0, endFrame: 3 }, totalFrames: 3, category: 'retake', evidence: 'synthetic', confidence: 1 });
  assert.equal(finding.status, 'needs-human-review');
  assert.throws(() => createReviewFinding({ range: { startFrame: 0, endFrame: 3 }, totalFrames: 3, category: 'x', evidence: '', confidence: 1 }));
});
