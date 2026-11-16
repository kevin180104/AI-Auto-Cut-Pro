import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve } from 'node:path';
import { analyzeActivity, approvedEdl } from '../speech-analysis/activity.js';
import { parseWavBuffer, renderWavFromEdl } from '../audio-engine/wav.js';

const [input, output, edlPath] = process.argv.slice(2);
if (!input || !output || !edlPath) { console.error('Usage: node scripts/review-wav.mjs input.wav output.wav output.edl.json'); process.exit(1); }
const paths = [input, output, edlPath].map(value => resolve(value));
if (new Set(paths.map(p => p.toLowerCase())).size !== 3) throw new Error('Source, output and EDL paths must be distinct');
const source = await readFile(paths[0]);
const analysis = analyzeActivity(source);
console.log('CẢNH BÁO: phát hiện năng lượng thấp có thể bỏ sót lời nói nhỏ. Hãy nghe từng vùng trước khi duyệt. Metadata WAV phụ sẽ bị bỏ.');
const rl = createInterface({ input: stdin, output: stdout });
const approved = [];
try {
  for (const p of analysis.proposals) {
    const answer = await rl.question(`${p.id}: ${p.startSeconds.toFixed(3)}–${p.endSeconds.toFixed(3)} giây. Đã nghe và duyệt xóa? [yes/no] `);
    if (answer.trim().toLowerCase() === 'yes') approved.push(p.id);
  }
} finally { rl.close(); }
const edl = approvedEdl(analysis, approved, paths[0], paths[1]);
await writeFile(paths[2], JSON.stringify(edl, null, 2), { flag: 'wx' });
const result = await renderWavFromEdl(edl);
const out = parseWavBuffer(await readFile(paths[1]));
const sourceHash = createHash('sha256').update(await readFile(paths[0])).digest('hex');
if (sourceHash !== analysis.source.sha256 || out.sampleFrames !== result.outputFrames || out.sampleRate !== analysis.source.sampleRate || out.channels !== analysis.source.channels) throw new Error('Output verification failed');
console.log(JSON.stringify({ ...result, sourceHashUnchanged: true, approved: approved.length, warning: 'Ancillary WAV metadata was not preserved; listening review is required.' }, null, 2));
