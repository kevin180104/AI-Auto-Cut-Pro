import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDecisionEdl,decidePauses,findRetakes,validateCalibration,RULE} from './decision-engine.js';
import {measureSignal,parseWavBuffer,renderWavBuffer} from '../audio-engine/wav.js';
import {score} from '../scripts/score-auto-edit.mjs';

const rate=8000;
function fixture(bits=16) {
  const width=bits/8, frames=24000;
  const b=Buffer.alloc(44+frames*width);
  b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);
  b.writeUInt32LE(16,16);b.writeUInt16LE(bits===16?1:3,20);b.writeUInt16LE(1,22);
  b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*width,28);b.writeUInt16LE(width,32);b.writeUInt16LE(bits,34);
  b.write('data',36);b.writeUInt32LE(b.length-44,40);
  for(let i=0;i<frames;i++) if(i<4000||i>=20000) {
    if(bits===16)b.writeInt16LE(800,44+i*width);else b.writeFloatLE(0.25,44+i*width);
  }
  return b;
}

// Synthetic attestation exercises the gate mechanics only. It cannot serve as real calibration.
const calibration={id:'synthetic-test-only',rule:RULE,independent:true,domain:'vietnamese-broadcast',
  cases:[...Array.from({length:100},(_,i)=>({sourceHash:String(1+i%10).padStart(64,'0'),selected:true,safe:true})),
    {sourceHash:'9'.repeat(64),selected:false,safe:false}]};
const pause={id:'quiet-1',startFrame:4000,endFrame:20000};
const segments=[{start:0,end:0.2,words:[{start:0,end:0.2}]}];
for(const bits of [16,32])test('calibrated gate performs a nonzero verified digital-silence cut for '+bits+'-bit fixture',()=>{
  const bytes=fixture(bits), wav=parseWavBuffer(bytes);
  const source={path:'source.wav',sha256:createHash('sha256').update(bytes).digest('hex'),sampleRate:rate,channels:1,totalSamples:24000};
  const config={source,speech:[],segments,measure:r=>measureSignal(bytes,wav,r.startFrame,r.endFrame),calibration};
  const [d]=decidePauses([pause],config);
  assert.equal(d.status,'AUTO_APPROVED');
  const edl=createDecisionEdl(source,'edited.wav',[d]);
  assert.equal(edl.removedSegments[0].approval,'auto-approved');
  const rendered=renderWavBuffer(bytes,edl);
  assert.equal(rendered.outputFrames,11200);
  const after=parseWavBuffer(rendered.buffer);
  const sampleBytes=wav.blockAlign;
  assert.deepEqual(rendered.buffer.subarray(after.dataOffset,after.dataOffset+5600*sampleBytes),bytes.subarray(44,44+5600*sampleBytes));
  const altered=Buffer.from(bytes);
  altered[44+6000*sampleBytes+sampleBytes-1]=32;
  const alteredHash=createHash('sha256').update(altered).digest('hex');
  edl.source.sha256=alteredHash;edl.removedSegments[0].provenance.sourceHash=alteredHash;
  assert.throws(()=>renderWavBuffer(altered,edl),/nonzero audio/);
  assert.equal(decidePauses([pause],{...config,shadow:true})[0].status,'RETAIN_UNCERTAIN');
  assert.equal(decidePauses([pause],{...config,calibration:null})[0].status,'RETAIN_UNCERTAIN');
  assert.equal(decidePauses([pause],{...config,speech:[{startFrame:6000,endFrame:6100}]})[0].status,'PROTECTED');
});
test('calibration fails closed on leakage, low diversity and false deletion',()=>{
  assert.equal(validateCalibration(calibration,calibration.cases[0].sourceHash),null);
  const weak=structuredClone(calibration); weak.cases[0].safe=false;
  assert.equal(validateCalibration(weak,'0'.repeat(64)),null);
  assert.equal(validateCalibration({...calibration,cases:calibration.cases.slice(0,3)},'0'.repeat(64)),null);
});
test('ordered alignment protects names and keeps intentional or ambiguous repeats',()=>{
  const measure=()=>({peak:0.4,fullScale:0});
  const make=(text,start)=>({text,start,end:start+1});
  const pair=(a,b,script)=>findRetakes([make(a,0),make(b,2)],[],rate,measure,script)[0];
  assert.equal(pair('đây là Hà Nội hôm nay','đây là Hà Nội hôm nay').status,'PROTECTED');
  assert.equal(pair('đây là bản tin mới','đây là bản tin mới').classification,'repetition-intent-unknown');
  assert.equal(pair('sáng nay trời rất lạnh ở đây','sáng nay trời rất đẹp ngoài kia'),undefined);
  const ranked=pair('đây là bản tin mới đầy đủ','đây là bản tin',['đây là bản tin mới đầy đủ']);
  assert.equal(ranked.classification,'possible-incomplete-restart');
  assert.equal(ranked.takes[0].startFrame,0);
});

test('labeled benchmark counts missed retakes and unsafe automatic cuts',()=>{
  const a={startFrame:0,endFrame:800}, b={startFrame:1000,endFrame:1600}, c={startFrame:2000,endFrame:2800};
  const report={decisions:[{kind:'retake',classification:'possible-correction',takes:[b,a]},{kind:'retake',classification:'repetition-intent-unknown',takes:[c,b]}]};
  const edl={source:{sha256:'source'},removedSegments:[{approval:'auto-approved',sourceStartSample:3000,sourceEndSample:3500}]};
  const labels={sourceHash:'source',retakes:[[a,b],[a,c]],safeRanges:[{startFrame:3000,endFrame:3400}]};
  assert.deepEqual(score(report,edl,labels),{retakes:{tp:1,fp:1,fn:1,precision:0.5,recall:0.5},cuts:{selected:1,unsafe:1,precision:0,falseDeletionRate:1}});
  assert.throws(()=>score(report,edl,{...labels,sourceHash:'other'}),/hash mismatch/);
  assert.equal(score(report,{...edl,removedSegments:[]},labels).cuts.falseDeletionRate,null);
});
