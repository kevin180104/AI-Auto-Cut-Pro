import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { analyzeActivity, approvedEdl } from './activity.js';
import { parseWavBuffer, renderWavBuffer } from '../audio-engine/wav.js';

function fixture(channels = 1, rate = 8000) {
  const frames = rate * 4, size = frames * channels * 2, b = Buffer.alloc(44 + size);
  b.write('RIFF'); b.writeUInt32LE(36 + size, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(channels, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * channels * 2, 28); b.writeUInt16LE(channels * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(size, 40);
  for (let i = 0; i < frames; i++) if (i < rate || i >= 3 * rate) for (let c = 0; c < channels; c++) b.writeInt16LE(c === 0 ? 7000 : -7000, 44 + (i * channels + c) * 2);
  return b;
}
for (const [channels, rate] of [[1, 8000], [2, 48000]]) test(`energy detector preserves margins at ${rate} Hz, ${channels} channels`, () => {
  const b = fixture(channels, rate); const result = analyzeActivity(b);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].startFrame, Math.round(rate * 1.2));
  assert.equal(result.proposals[0].endFrame, Math.round(rate * 2.8));
  const reject = approvedEdl(result, [], 'source.wav', 'out.wav');
  assert.equal(reject.removedSegments.length, 0);
  const edl = approvedEdl(result, [result.proposals[0].id], 'source.wav', 'out.wav');
  const rendered = renderWavBuffer(b, edl); assert.equal(rendered.outputFrames, rate * 4 - (result.proposals[0].endFrame - result.proposals[0].startFrame));
  assert.throws(() => approvedEdl(result, ['unknown'], 'source.wav', 'out.wav'));
});
test('silent input and unsupported WAV produce no unsafe proposal', () => {
  const b = fixture(); b.fill(0, 44); assert.equal(analyzeActivity(b).proposals.length, 0);
  b.writeUInt16LE(8, 34); assert.throws(() => analyzeActivity(b));
});
test('CLI accepts a human approval and preserves source hash while producing valid WAV and EDL', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aacp-')); const src = join(dir, 'source.wav'), out = join(dir, 'output.wav'), edl = join(dir, 'edl.json');
  const b = fixture(); await writeFile(src, b); const hash = createHash('sha256').update(b).digest('hex');
  const run = spawnSync(process.execPath, ['scripts/review-wav.mjs', src, out, edl], { input: 'yes\n', encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr); assert.equal(createHash('sha256').update(await readFile(src)).digest('hex'), hash);
  assert.equal(JSON.parse(await readFile(edl, 'utf8')).removedSegments[0].approval, 'human-approved');
  assert.ok(parseWavBuffer(await readFile(out)).sampleFrames < 32000);
  const collision = spawnSync(process.execPath, ['scripts/review-wav.mjs', src, out, edl], { input: 'yes\n', encoding: 'utf8' }); assert.notEqual(collision.status, 0);
});
