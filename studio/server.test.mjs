import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStudio } from './server.mjs';
import { parseWavBuffer } from '../audio-engine/wav.js';

function fixture() {
  const wav = Buffer.alloc(44+12000);
  wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
  wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
  for(let i=44;i<wav.length;i+=2)wav.writeInt16LE(i-4000,i);
  return wav;
}
test('Studio loads 140, isolates requests and decisions, and exports only approvals', async t=>{
  const dir=await mkdtemp(join(tmpdir(),'aacp-studio-test-'));
  const bits=fixture(), sourcePath=join(dir,'source.wav');
  const source={path:sourcePath,sha256:createHash('sha256').update(bits).digest('hex'),sampleRate:8000,channels:1,totalSamples:6000};
  const proposals=Array.from({length:140},(_,i)=>({id:'quiet-'+(i+1),startFrame:i*40+80,endFrame:i*40+90,startSeconds:(i*40+80)/8000,endSeconds:(i*40+90)/8000,reason:'test'}));
  await writeFile(sourcePath,bits);
  await writeFile(join(dir,'review.json'),JSON.stringify({proposals,source,detector:'fixture',settings:{}}));
  await writeFile(join(dir,'reference.edl.json'),JSON.stringify({source}));
  for(const variant of ['before','after'])await writeFile(join(dir,'quiet-1-'+variant+'.wav'),bits);
  const server=await createStudio(dir);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  const base='http://127.0.0.1:'+server.address().port;
  const get=()=>fetch(base+'/api/state').then(r=>r.json());
  let state=await get();
  const post=(path,fields)=>fetch(base+'/api/'+path,{method:'POST',headers:{origin:base,'x-studio':'1','content-type':'application/json'},body:JSON.stringify({sourceHash:state.sourceHash,proposalVersion:state.proposalVersion,revision:state.revision,...fields})});
  assert.equal(state.proposals.length,140);assert.deepEqual(state.decisions,{});
  for(const variant of ['before','after']){
    const response=await fetch(base+'/audio/quiet-1/'+variant,{headers:{range:'bytes=0-43'}});
    assert.equal(response.status,206); assert.equal((await response.arrayBuffer()).byteLength,44);
  }
  assert.equal((await fetch(base+'/api/state',{headers:{origin:'http://evil.test'}})).status,403);
  assert.equal((await fetch(base+'/audio/quiet-999/before')).status,404);
  assert.equal((await post('decision',{id:'quiet-1',status:'APPROVE',sourceHash:'wrong'})).status,409);
  assert.equal((await post('decision',{id:'quiet-1',status:'APPROVE'})).status,200);
  assert.equal((await post('decision',{id:'quiet-2',status:'APPROVE'})).status,409);
  state=await get();assert.equal(state.decisions['quiet-1'].status,'APPROVE');
  assert.equal((await post('decision',{id:'quiet-1',status:'KEEP'})).status,409);
  assert.equal((await post('decision',{id:'quiet-1',status:'KEEP',replace:true})).status,200);
  state=await get();
  assert.equal((await post('decision',{id:'quiet-1',status:'APPROVE',replace:true})).status,200);
  state=await get();
  await writeFile(sourcePath,Buffer.concat([bits,Buffer.from([0])]));
  assert.equal((await post('export',{confirm:true})).status,409);
  await writeFile(sourcePath,bits);
  assert.equal((await post('export',{confirm:true,crossfade:true})).status,200);
  const edl=JSON.parse(await readFile(join(dir,'studio-r3.edl.json'),'utf8'));
  assert.deepEqual(edl.removedSegments.map(x=>x.id),['quiet-1']);
  assert.equal(parseWavBuffer(await readFile(join(dir,'studio-r3.wav'))).sampleFrames,5990);
  assert.equal(parseWavBuffer(await readFile(join(dir,'studio-r3-crossfade.wav'))).sampleFrames,5950);
  assert.equal((await post('export',{confirm:true})).status,409);
  assert.deepEqual(await readFile(sourcePath),bits);
});
