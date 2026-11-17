import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {parseWavBuffer,renderWavBuffer,measureSignal} from '../audio-engine/wav.js';
import {publishRender} from '../audio-engine/publish.js';
import {exportMp3} from '../audio-engine/mp3.js';
import {proposalsFromActive} from '../speech-analysis/activity.js';
import {createDecisionEdl,decidePauses,findRetakes} from '../speech-analysis/decision-engine.js';
import {compareTranscripts} from './compare-asr.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const args=process.argv.slice(2);
const option=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
if(!args[0]||!option('--output'))throw Error('Usage: node scripts/auto-edit.mjs input.wav --output new-directory [--shadow] [--calibration local.json] [--script local.txt] [--prepared local-directory]');
const input=resolve(args[0]), out=resolve(option('--output'));
const python=process.env.AACP_ASR_PYTHON, model=process.env.AACP_ASR_MODEL;
const ffmpeg=process.env.AACP_FFMPEG||'C:/Program Files/FormatFactory5.21.0.0/ffmpeg.exe';
if(!python||!model)throw Error('Set AACP_ASR_PYTHON and AACP_ASR_MODEL');
const bytes=await readFile(input), wav=parseWavBuffer(bytes);
const source={path:input,sha256:hash(bytes),sampleRate:wav.sampleRate,channels:wav.channels,totalSamples:wav.sampleFrames};
if(![1,2].includes(wav.channels)||!wav.sampleFrames)throw Error('Expected nonempty mono or stereo WAV');
const measure=r=>measureSignal(bytes,wav,r.startFrame,r.endFrame);
const sourceSignal=measureSignal(bytes,wav);
function audioHash(data) {
  const parsed=parseWavBuffer(data);
  return hash(data.subarray(parsed.dataOffset,parsed.dataOffset+parsed.dataLength));
}
function run(bin,params, capture=false) {
  const result=spawnSync(bin,params,capture?{encoding:'utf8',maxBuffer:16*1024*1024}:{stdio:'inherit'});
  if(result.status!==0)throw Error('Local analysis command failed: '+(result.error?.message||result.stderr||result.status));
  return result.stdout;
}
function transcribe(path,target) {
  run(python,[join(import.meta.dirname,'../speech-analysis/transcribe_vi.py'),path,target,'--model',model]);
}
const calibration=option('--calibration')?await json(option('--calibration')):null;
const script=option('--script')?(await readFile(option('--script'),'utf8')).split(/\r?\n/).filter(s=>s.trim()):[];
await mkdir(out);
const temp=await mkdtemp(join(out,'.analysis-'));
try {
  let review,asr;
  if(option('--prepared')){
    const dir=resolve(option('--prepared'));
    review=await json(join(dir,'review.json'));
    const reference=await readFile(join(dir,'reference.wav'));
    asr=await json(join(dir,'sprint4/source-asr.json'));
    if(review.source.sha256!==source.sha256||audioHash(reference)!==audioHash(bytes)||asr.inputSha256!==hash(reference))throw Error('Prepared analysis does not match source');
    await writeFile(join(out,'source-asr.json'),JSON.stringify(asr),{flag:'wx'});
  }else{
    const analysisWav=join(temp,'vad-pcm16.wav');
    run(ffmpeg,['-nostdin','-v','error','-n','-i',input,'-map','0:a:0','-c:a','pcm_s16le',analysisWav]);
    const vad=JSON.parse(run(python,[join(import.meta.dirname,'../speech-analysis/silero_vad_local.py'),analysisWav],true));
    if(vad.sampleRate!==wav.sampleRate||vad.frames!==wav.sampleFrames||vad.channels!==wav.channels)throw Error('VAD analysis grid differs from source');
    review=proposalsFromActive(wav,bytes,vad.regions,{marginMs:200,minQuietMs:1000,channelRegions:vad.channelRegions},vad.detector);
    transcribe(input,join(out,'source-asr.json'));
    asr=await json(join(out,'source-asr.json'));
    if(asr.inputSha256!==source.sha256)throw Error('ASR source hash mismatch');
  }
  if(asr.language!=='vi'||!Array.isArray(asr.segments))throw Error('Invalid Vietnamese ASR output');
  const shadow=args.includes('--shadow');
  const decisions=[...decidePauses(review.proposals,{source,speech:review.active,segments:asr.segments,measure,calibration,shadow}),
    ...findRetakes(asr.segments,review.active,wav.sampleRate,measure,script)];
  const target=join(out,'auto-edited.wav');
  let edl=createDecisionEdl(source,target,decisions);
  let rollback=null;
  const check=async(path,name)=>{
    const targetJson=join(out,name);
    transcribe(path,targetJson);
    const result=await json(targetJson);
    if(result.inputSha256!==hash(await readFile(path))||result.model!==asr.model||result.runtime!==asr.runtime||result.language!==asr.language)throw Error('Output ASR identity mismatch');
    return result;
  };
  let post;
  if(edl.removedSegments.length){
    const trial=join(temp,'trial.wav');
    try {
      const rendered=renderWavBuffer(bytes,edl);
      const measured=measureSignal(rendered.buffer,parseWavBuffer(rendered.buffer));
      if(measured.peak>sourceSignal.peak)throw Error('Peak increased');
      await writeFile(trial,rendered.buffer,{flag:'wx'});
      post=await check(trial,'trial-asr.json');
      const comparison=compareTranscripts(asr,post);
      if(comparison.sameExecutionProfile!==true)throw Error('ASR execution profile differs or is unavailable');
      if(!comparison.sameWords)throw Error('ASR word sequence changed');
    }catch(error){
      rollback=error.message;
      for(const d of decisions.filter(d=>d.status==='AUTO_APPROVED')){
        d.status='RETAIN_UNCERTAIN';
        d.rollback=rollback;
      }
      edl=createDecisionEdl(source,target,decisions);
      post=null;
    }
  }
  const rendered=await publishRender(edl,join(out,'auto-edited.edl.json'));
  const outputBytes=await readFile(target), outputWav=parseWavBuffer(outputBytes);
  if(!edl.removedSegments.length&&audioHash(outputBytes)!==audioHash(bytes))throw Error('Keep-all sample integrity check failed');
  if(post&&post.inputSha256!==hash(outputBytes))throw Error('Published WAV differs from verified trial');
  if(!post)post=await check(target,'output-asr.json');
  else await writeFile(join(out,'output-asr.json'),JSON.stringify(post),{flag:'wx'});
  const mp3=await exportMp3({ffmpegPath:ffmpeg,sourcePath:target,outputPath:join(out,'auto-edited.mp3')});
  const asrComparison=compareTranscripts(asr,post);
  const summary={shadow,rollback,segments:asr.segments.length,pauses:review.proposals.length,retakes:decisions.filter(d=>d.kind==='retake').length,
    cuts:edl.removedSegments.length,framesBefore:wav.sampleFrames,framesAfter:rendered.outputFrames,mp3DecodedFrames:mp3.decodedFrames,
    sourceHashUnchanged:hash(await readFile(input))===source.sha256,signal:measureSignal(outputBytes,outputWav),
    asrWordSequenceMatch:asrComparison.sameWords,asrComparison,listening:'NOT TESTED'};
  if(!summary.sourceHashUnchanged)throw Error('Source changed during operation');
  await writeFile(join(out,'auto-edit-report.json'),JSON.stringify({...summary,decisions},null,2),{flag:'wx'});
  await writeFile(join(out,'auto-edit-report.md'),[
    '# Kết quả Auto Edit','',...Object.entries(summary).map(([key,value])=>'- '+key+' — '+JSON.stringify(value)),
    '', '| ID | Phân loại | Trạng thái | Frame bắt đầu | Frame kết thúc | Căn cứ |','| --- | --- | --- | --- | --- | --- |',
    ...decisions.map(d=>'| '+[d.id,d.classification??d.kind,d.status,d.startFrame??d.takes[0].startFrame,d.endFrame??d.takes[0].endFrame,d.reason].join(' | ')+' |'),
  ].join('\n')+'\n',{flag:'wx'});
  console.log(summary);
}finally{await rm(temp,{recursive:true,force:true});}
