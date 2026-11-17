import test from 'node:test';
import assert from 'node:assert/strict';
import {classify} from './auto-evidence.js';
const segment = (text,start) => ({text,start,end:start+1,words:[{start,end:start+1,score:0.9}]});
for (const [label,first,second] of [
 ['unfinished reading','đây là một','đây là một bản tin đầy đủ'],
 ['stumble','các em đang đang học','các em đang học'],
 ['intentional repetition','chúng ta hãy nhớ','chúng ta hãy nhớ'],
 ['wrong then corrected number','đây là ngày 24','đây là ngày 25'],
 ['proper name','đây là tỉnh Hà Nội','đây là tỉnh Hà Nội'],
]) test(label+' never grants approval',()=>{
 const findings=classify([segment(first,0),segment(second,2)],[]);
 assert.equal(findings.length,1);
 assert.notEqual(findings[0].mode,'AUTO');
 if (label.includes('number')||label.includes('name')) assert.equal(findings[0].mode,'PROTECTED');
});
test('quiet speech evidence protects a pause and uncertain pauses are retained',()=>{
 const findings=classify([segment('đọc nhỏ',2)],[
  {id:'speech',startSeconds:1.9,endSeconds:3.1},{id:'expressive',startSeconds:3.1,endSeconds:3.8},{id:'long',startSeconds:10,endSeconds:15},
 ]);
 assert.deepEqual(findings.map(f=>f.mode),['PROTECTED','CONSERVATIVE','CONSERVATIVE']);
});
test('shorter final take is not ranked first automatically',()=>{
 const findings=classify([segment('đây là một bản tin đầy đủ',0),segment('đây là một',2)],[]);
 assert.equal(findings[0].takes[0].start,0);
});

test('human report uses the measured full-scale count', async ()=>{
 const {formatFullScaleCount}=await import('./auto-evidence.js');
 assert.match(formatFullScaleCount({fullScaleSamples:17}),/17\.$/);
 assert.throws(()=>formatFullScaleCount({}));
});
