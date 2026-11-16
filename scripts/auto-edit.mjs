import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {parseWavBuffer} from '../audio-engine/wav.js';
import {publishRender} from '../audio-engine/publish.js';
import {exportMp3} from '../audio-engine/mp3.js';
import {classify, formatFullScaleCount} from '../speech-analysis/auto-evidence.js';

const dir=resolve(process.argv[2] || 'work/acceptance/real-01');
const out=join(dir,'sprint4');
const review=JSON.parse(await readFile(join(dir,'review.json'),'utf8'));
const reference=JSON.parse(await readFile(join(dir,'reference.edl.json'),'utf8'));
await mkdir(out,{recursive:true});
const python=process.env.AACP_ASR_PYTHON;
const model=process.env.AACP_ASR_MODEL;
if(!python||!model) throw Error('Set AACP_ASR_PYTHON and AACP_ASR_MODEL');
function transcribe(wav, output) {
  const result=spawnSync(python,[join(import.meta.dirname,'../speech-analysis/transcribe_vi.py'),wav,output,'--model',model],{stdio:'inherit'});
  if(result.status!==0) throw Error('Local ASR failed: '+(result.error?.message||result.status));
}
const sourceAsrPath=join(out,'source-asr.json');
let asr;
try { asr=JSON.parse(await readFile(sourceAsrPath,'utf8')); }
catch(error) {
  if(error.code!=='ENOENT') throw error;
  transcribe(join(dir,'reference.wav'),sourceAsrPath);
  asr=JSON.parse(await readFile(sourceAsrPath,'utf8'));
}
if (!asr.segments.length || asr.language!=='vi' || reference.source.sha256!==review.source.sha256) throw Error('Invalid local analysis or source identity');
const referenceBytes=await readFile(join(dir,'reference.wav'));
if(createHash('sha256').update(referenceBytes).digest('hex')!==asr.inputSha256) throw Error('ASR input does not match the reference WAV');
const findings=classify(asr.segments,review.proposals);
const edl={version:1,source:reference.source,output:{path:join(out,'auto-edited.wav')},keepSegments:[{id:'keep-all',sourceStartSample:0,sourceEndSample:reference.source.totalSamples}],removedSegments:[],
  automation:{autoEligible:0,reason:'No independently calibrated deletion criteria for this recording'}};
function metrics(buffer) {
  const wav=parseWavBuffer(buffer);
  if(wav.effectiveFormatTag!==3||wav.bitsPerSample!==32) throw Error('Sprint 4 signal check expects float32 WAV');
  let peak=0,squares=0,fullScale=0;
  const hash=createHash('sha256').update(buffer.subarray(wav.dataOffset,wav.dataOffset+wav.dataLength)).digest('hex');
  for(let i=wav.dataOffset;i<wav.dataOffset+wav.dataLength;i+=4){
    const value=buffer.readFloatLE(i);
    if(!Number.isFinite(value))throw Error('Non-finite sample');
    peak=Math.max(peak,Math.abs(value));squares+=value*value;if(Math.abs(value)>=1)fullScale++;
  }
  return {hash,peak,rms:Math.sqrt(squares/(wav.dataLength/4)),fullScale};
}
const before=metrics(await readFile(edl.source.path));
if(metrics(referenceBytes).hash!==before.hash) throw Error('Reference audio samples differ from the original');
const render=await publishRender(edl,join(out,'auto-edited.edl.json'));
const mp3=await exportMp3({ffmpegPath:process.env.AACP_FFMPEG||'C:/Program Files/FormatFactory5.21.0.0/ffmpeg.exe',sourcePath:edl.output.path,outputPath:join(out,'auto-edited.mp3')});
const after=metrics(await readFile(edl.output.path));
if(before.hash!==after.hash || !render.sourceHashUnchanged) throw Error('Keep-all integrity check failed');
const postPath=join(out,'output-asr.json');
transcribe(edl.output.path,postPath);
const outputAsr=JSON.parse(await readFile(postPath,'utf8'));
if(outputAsr.inputSha256!==createHash('sha256').update(await readFile(edl.output.path)).digest('hex')||outputAsr.runtime!==asr.runtime||outputAsr.model!==asr.model||outputAsr.language!==asr.language||!outputAsr.segments.length) throw Error('Invalid output ASR');
const canonical=x=>x.segments.map(s=>[s.start,s.end,s.text,s.words.map(w=>[w.start,w.end,w.text])]);
const asrSame=JSON.stringify(canonical(asr))===JSON.stringify(canonical(outputAsr));
const counts=Object.fromEntries(['AUTO','CONSERVATIVE','PROTECTED'].map(mode=>[mode,findings.filter(f=>f.mode===mode).length]));
const report={counts,model:asr.model,segments:asr.segments.length,findings,autoCuts:0,originalFrames:edl.source.totalSamples,outputFrames:render.outputFrames,mp3DecodedFrames:mp3.decodedFrames,identicalWavSamples:true,peak:after.peak,rms:after.rms,fullScaleSamples:after.fullScale,postAsr:{segments:outputAsr.segments.length,identicalTextAndTimestamps:asrSame},listening:'NOT TESTED'};
await writeFile(join(out,'auto-edit-report.json'),JSON.stringify(report,null,2),{flag:'wx'});
await writeFile(join(out,'auto-edit-report.md'),[
  '# Báo cáo Auto Edit cục bộ',
  '',
  'Vùng cắt: 0. Chưa có tiêu chí cắt tự động đã hiệu chuẩn.',
  'Số phát hiện giữ nguyên: '+counts.CONSERVATIVE+' chưa chắc chắn, '+counts.PROTECTED+' được bảo vệ.',
  'WAV: '+report.outputFrames+' frame, dữ liệu mẫu khớp nguồn.',
  'MP3: 192 kbps, '+report.mp3DecodedFrames+' frame sau giải mã.',
  'Peak tuyệt đối: '+report.peak.toFixed(6)+'. RMS: '+report.rms.toFixed(6)+'. '+formatFullScaleCount(report),
  'ASR nguồn / xuất: '+report.segments+' / '+report.postAsr.segments+' đoạn. Văn bản và timestamp giống nhau: '+asrSame+'.',
  'Kiểm tra điểm nối: không áp dụng vì không có điểm cắt. Chất lượng nghe: NOT TESTED.',
].join('\n')+'\n',{flag:'wx'});
console.log({segments:report.segments,findings:findings.length,cuts:0,frames:report.outputFrames});
