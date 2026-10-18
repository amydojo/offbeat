/* OFFBEAT musical evolution regression suite — uses Node's built-in test runner. */
const test=require('node:test');
const assert=require('node:assert/strict');
const e=require('../public/bass-mirror/evolution-core.js');
const originals={
 RECALL:{low:[0,8],pulse:[3,11],rise:[6],spark:[14],other:[],shift:[],knock:[0,8],tick:[4,12],scrape:[10,14]},
 WANDER:{low:[0,10],pulse:[2,12],rise:[6,15],spark:[11],other:[5],shift:[8],knock:[0,10],tick:[3,7,11,15],scrape:[6,14]},
 FRACTURE:{low:[0,2,13],pulse:[11],rise:[3,7],spark:[15],other:[5,12],shift:[8],knock:[0,9],tick:[1,5,13],scrape:[4,11]}
};
for(const [name,base] of Object.entries(originals)){
 test(name+' preserves riff and returns to it',()=>{
  const before=JSON.stringify(base),p=e.compose(base);
  assert.equal(JSON.stringify(base),before,'must not mutate input');
  assert.equal(p.bars.length,8);
  assert.equal(e.signature(p.bars[0].pattern),e.signature(p.base));
  assert.equal(e.signature(p.bars[1].pattern),e.signature(p.base));
  assert.equal(e.signature(p.bars[7].pattern),e.signature(p.base));
  assert.equal(p.bars.filter(b=>b.difference>0).length,5);
  assert.ok(p.bars.every(b=>b.difference<=4),'too much change ruins the groove');
  assert.ok(p.bars.every(b=>e.signature({[p.anchor]:b.pattern[p.anchor],...Object.fromEntries(e.IDS.filter(id=>id!==p.anchor).map(id=>[id,[]]))})===e.signature({[p.anchor]:p.base[p.anchor],...Object.fromEntries(e.IDS.filter(id=>id!==p.anchor).map(id=>[id,[]]))})), 'anchor was overwritten');
 });
 test(name+' live and export share every scheduled event',()=>{
  const p=e.compose(base);
  const first=Array.from({length:128},(_,step)=>e.eventsAt(p,step));
  const repeated=Array.from({length:128},(_,step)=>e.eventsAt(p,step+128));
  assert.deepEqual(first,repeated);
  assert.ok(first.every((events,absolute)=>events.every(n=>p.bars[Math.floor(absolute/16)].pattern[n.id].includes(absolute%16))));
  assert.ok(first.flat().every(n=>n.velocity>0&&n.velocity<=1));
 });
}
test('empty pattern produces valid evolution without crashes',()=>{
 const p=e.compose(Object.fromEntries(e.IDS.map(id=>[id,[]])));
 assert.equal(p.bars.length,8);
 assert.equal(e.eventsAt(p,0).length,0);
 assert.equal(e.signature(p.bars[7].pattern),e.signature(p.base));
});
test('malformed steps normalized and never enter scheduled audio',()=>{
 const data={low:[0,0,-1,9,16,'4'],pulse:[2.5,5],knock:[3,3]};
 const p=e.compose(data);
 assert.deepEqual(p.base.low,[0,9]);
 assert.deepEqual(p.base.pulse,[5]);
 assert.deepEqual(p.base.knock,[3]);
 assert.ok(Array.from({length:128},(_,i)=>e.eventsAt(p,i)).flat().every(n=>e.IDS.includes(n.id)&&Number.isInteger(n.step)&&n.step>=0&&n.step<16));
});
