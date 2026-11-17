import { access, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyzeActivity, approvedEdl, proposalsFromActive } from '../speech-analysis/activity.js';
import { parseWavBuffer } from '../audio-engine/wav.js';
import { publishRender } from '../audio-engine/publish.js';
import { makePreview } from '../speech-analysis/preview.js';

const [input, output, edlPath] = process.argv.slice(2);
if (!input || !output || !edlPath) { console.error('Usage: node scripts/review-wav.mjs input.wav output.wav output.edl.json'); process.exit(1); }
const paths = [input, output, edlPath].map(value => resolve(value));
if (new Set(paths.map(p => p.toLowerCase())).size !== 3) throw new Error('Source, output and EDL paths must be distinct');
for (const destination of [paths[1], paths[2]]) {
  try { await access(destination); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  throw new Error(`Destination already exists: ${destination}`);
}
const source = await readFile(paths[0]);
let analysis;
if (process.env.AACP_VAD_PYTHON) {
  const run = spawnSync(process.env.AACP_VAD_PYTHON, [fileURLToPath(new URL('../speech-analysis/silero_vad_local.py', import.meta.url)), paths[0]], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`Silero failed; no fallback or deletion: ${run.stderr}`);
  const vad = JSON.parse(run.stdout); const wav = parseWavBuffer(source);
  if (vad.sampleRate !== wav.sampleRate || vad.frames !== wav.sampleFrames || vad.channels !== wav.channels) throw new Error('VAD source format mismatch');
  analysis = proposalsFromActive(wav, source, vad.regions, { marginMs: 200, minQuietMs: 1000, channelRegions: vad.channelRegions }, vad.detector);
} else analysis = analyzeActivity(source);
console.log('CẢNH BÁO: VAD có thể bỏ sót lời nói nhỏ. Hãy nghe từng vùng trước khi duyệt. Metadata WAV phụ sẽ bị bỏ.');
const approved = [];
const previewDir = await mkdtemp(join(tmpdir(), 'aacp-review-'));
console.log(`Preview tạm: ${previewDir} (chứa âm thanh cục bộ; tự xóa khi không còn cần).`);
const previews = [];
for (const p of analysis.proposals) {
  const preview = makePreview(source, analysis, p);
  const before = join(previewDir, `${p.id}-before.wav`), after = join(previewDir, `${p.id}-after.wav`);
  await writeFile(before, preview.before, { flag: 'wx' }); await writeFile(after, preview.after, { flag: 'wx' });
  previews.push({ p, before, after });
}
const rl = createInterface({ input: stdin, output: stdout });
try {
  for (const { p, before, after } of previews) {
    console.log(`${p.id} ${p.startSeconds.toFixed(3)}–${p.endSeconds.toFixed(3)} giây; ${(p.endSeconds - p.startSeconds).toFixed(3)} giây; ${p.reason}; detector=${analysis.detector}; trạng thái=pending\nTrước: ${before}\nSau: ${after}`);
    for (;;) {
      const answer = (await rl.question('Mở [b]ản trước/[a] sau, [yes] duyệt xóa, [no] giữ lại, [q] hủy: ')).trim().toLowerCase();
      if (answer === 'q') throw new Error('User cancelled; no EDL or output written');
      if (answer === 'yes') { approved.push(p.id); break; }
      if (answer === 'b' || answer === 'a') {
        if (process.platform !== 'win32') console.log('Mở file preview bằng trình phát trên máy.');
        else { const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', answer === 'b' ? before : after], { detached: true, stdio: 'ignore' }); child.on('error', error => console.error(`Không mở được trình phát: ${error.message}`)); child.unref(); }
        continue;
      }
      break; // Default is keep.
    }
  }
} finally { rl.close(); }
const edl = approvedEdl(analysis, approved, paths[0], paths[1]);
const removed = edl.removedSegments.reduce((sum, r) => sum + r.sourceEndSample - r.sourceStartSample, 0);
if (removed / analysis.source.totalSamples > 0.25) console.warn(`CẢNH BÁO: giảm ${(100 * removed / analysis.source.totalSamples).toFixed(1)}% thời lượng; hãy kiểm tra lại.`);
const result = await publishRender(edl, paths[2]);
console.log(JSON.stringify({ ...result, approved: approved.length, warning: 'Ancillary WAV metadata was not preserved; listening review is required.' }, null, 2));
