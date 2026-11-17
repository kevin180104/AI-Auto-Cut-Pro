import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {evaluateCorpus} from './evaluate-corpus.mjs';

test('corpus scores preserve zero denominator and reject cross-split reuse and incomplete labels', async t=>{
  const dir=await mkdtemp(join(tmpdir(),'aacp-corpus-test-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const save=(name,value)=>writeFile(join(dir,name),JSON.stringify(value));
  const sourceHash='1'.repeat(64);
  const label={sourceHash,annotationComplete:true,retakes:[],safeRanges:[]};
  const entry={split:'acceptance',authorized:true,independent:true,reviewer:'synthetic reviewer',
    report:'report.json',edl:'edl.json',labels:'labels.json'};
  await save('report.json',{decisions:[]});
  await save('edl.json',{source:{sha256:sourceHash,totalSamples:100},removedSegments:[]});
  await save('labels.json',label);
  const manifest=join(dir,'manifest.json');
  await save('manifest.json',{version:1,recordings:[entry]});
  const result=await evaluateCorpus(manifest);
  assert.equal(result.acceptance.recordings,1);
  assert.equal(result.acceptance.cuts.falseDeletionRate,null);
  await save('manifest.json',{version:1,recordings:[entry,{...entry,split:'development'}]});
  await assert.rejects(evaluateCorpus(manifest),/Duplicate/);
  await save('manifest.json',{version:1,recordings:[entry]});
  await save('labels.json',{...label,annotationComplete:false});
  await assert.rejects(evaluateCorpus(manifest),/Partial annotation/);
});
