import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTranscripts} from './compare-asr.mjs';

test('separates identical audio and profile from conflicting ASR words',()=>{
  const a={inputSha256:'first',pcmSha256:'pcm',profile:{threads:8},segments:[{text:'ngày mười'}]};
  const b={...a,inputSha256:'second',segments:[{text:'ngày hai mươi'}]};
  assert.deepEqual(compareTranscripts(a,b),{
    sameInputFile:false,sameDecodedSamples:true,sameExecutionProfile:true,sameWords:false,segments:[1,1]
  });
});

test('legacy transcripts do not establish decoder or execution identity',()=>{
  const a={segments:[{text:'Hà Nội'}]},b={segments:[{text:'Hà Nội'}]};
  const result=compareTranscripts(a,b);
  assert.equal(result.sameDecodedSamples,null);
  assert.equal(result.sameExecutionProfile,null);
  assert.equal(result.sameWords,true);
});
