import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPcm16Effects } from './effects.js';

function pcm(values) { const b = Buffer.alloc(values.length * 2); values.forEach((v, i) => b.writeInt16LE(v, i * 2)); return b; }
test('approved stereo crossfade reduces discontinuity without clipping and preserves outside samples', () => {
  const a = pcm([30000,-30000, 30000,-30000, 30000,-30000, 30000,-30000]);
  const b = pcm([-30000,30000, -30000,30000, -30000,30000, -30000,30000]);
  const result = applyPcm16Effects([a,b], 2, 1000, { approval: 'human-approved', crossfadeFrames: 2 });
  assert.equal(result.sampleFrames, 6); assert.equal(result.buffer.readInt16LE(0), 30000); assert.equal(result.buffer.readInt16LE(22), 30000);
  for (let i = 0; i < result.buffer.length; i += 2) assert.ok(Math.abs(result.buffer.readInt16LE(i)) <= 30000);
  assert.ok(Math.abs(result.buffer.readInt16LE(8)) < 30000);
});
test('fade effects require approval and reject unsafe lengths', () => {
  const part = pcm([20000,20000,20000,20000]);
  assert.throws(() => applyPcm16Effects([part],1,1000,{}), /approval/);
  assert.throws(() => applyPcm16Effects([part,part],1,1000,{ approval:'human-approved', crossfadeFrames:11 }), /10 ms/);
  const result = applyPcm16Effects([part],1,1000,{ approval:'human-approved', fadeInFrames:2, fadeOutFrames:2 });
  assert.deepEqual([0,2,4,6].map(i => result.buffer.readInt16LE(i)), [10000,20000,20000,10000]);
});
