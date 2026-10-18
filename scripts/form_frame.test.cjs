const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const fs=require('node:fs');
const imported=import(pathToFileURL(path.resolve(__dirname,'../public/instrument/frame/core.mjs')).href);
test('starter plays two bars with a whole authored groove and dependent parts',async()=>{
 const c=await imported,f=c.starter(),out=c.compileFrame(f);
 assert.ok(c.validate(f));assert.equal(f.bpm,96);assert.equal(out.duration,5);
 assert.ok(out.bass.length>=6);assert.ok(out.harmony.length>=6);assert.ok(out.drums.length>=12);
 assert.ok(out.events.every(e=>e.time>=0&&e.time<=5));
});
test('the same frame produces exact same musical result',async()=>{
 const c=await imported,f=c.starter();
 assert.deepEqual(c.compileFrame(f),c.compileFrame(structuredClone(f)));
});
test('one bass height edit moves that note and a causally related harmony voice',async()=>{
 const c=await imported,f=c.starter(),before=c.compileFrame(f);
 const changed=c.update(f,'b4',{height:.96}),after=c.compileFrame(changed);
 assert.notEqual(before.bass.find(e=>e.sourceId==='b4').frequency,after.bass.find(e=>e.sourceId==='b4').frequency);
 assert.notEqual(before.harmony.find(e=>e.sourceId==='b4').frequency,after.harmony.find(e=>e.sourceId==='b4').frequency);
 assert.deepEqual(before.bass.find(e=>e.sourceId==='b1'),after.bass.find(e=>e.sourceId==='b1'));
 assert.ok(c.diffRender(before,after).some(x=>x.kind==='harmony'&&x.sourceId==='b4'));
 assert.deepEqual(f,c.starter(),'source untouched');
});
test('a big shape movement affects one dependent rhythmic accent, not entire meter',async()=>{
 const c=await imported,f=c.starter(),before=c.compileFrame(f);
 const after=c.compileFrame(c.update(f,'b4',{height:.97}));
 const beforeBase=before.drums.filter(x=>x.reason==='pulse').map(x=>[x.kind,x.time]);
 const afterBase=after.drums.filter(x=>x.reason==='pulse').map(x=>[x.kind,x.time]);
 assert.deepEqual(beforeBase,afterBase);
 assert.ok(after.drums.some(x=>x.reason==='high_phrase_response'&&x.derivedFromIds.includes('b4')));
});
test('remove a note and its supporting harmony; silence is meaningful and reversible',async()=>{
 const c=await imported,f=c.starter();
 const quiet=c.update(f,'b4',{rest:true}),render=c.compileFrame(quiet);
 assert.ok(!render.bass.some(e=>e.sourceId==='b4'));
 assert.ok(!render.harmony.some(e=>e.sourceId==='b4'));
 const restored=c.update(quiet,'b4',{rest:false});
 assert.equal(c.compileFrame(restored).bass.length,c.compileFrame(f).bass.length);
});
test('harmony constraint is audible and not just a decorative toggle',async()=>{
 const c=await imported,f=c.starter();
 const edited=c.update(f,'b4',{height:.94});
 const guided=c.compileFrame(edited),free=c.compileFrame(c.setConstraint(edited,'harmony',false));
 assert.notEqual(guided.bass.find(x=>x.sourceId==='b4').frequency,free.bass.find(x=>x.sourceId==='b4').frequency);
 assert.notEqual(guided.harmony.find(x=>x.sourceId==='b4').frequency,free.harmony.find(x=>x.sourceId==='b4').frequency);
 assert.ok(free.bass.some(x=>x.free));
});
test('pulse and feel constraint toggles audibly alter the compiled performance',async()=>{
 const c=await imported,f=c.starter(),locked=c.compileFrame(f);
 const floating=c.compileFrame(c.setConstraint(f,'pulse',false));
 assert.notDeepEqual(locked.drums.map(x=>[x.kind,x.time]),floating.drums.map(x=>[x.kind,x.time]));
 const smooth=c.compileFrame(c.setConstraint(f,'feel',false));
 assert.notDeepEqual(locked.bass.map(x=>x.time),smooth.bass.map(x=>x.time));
});
test('history supports undo, redo, original and deterministic variant suggestions',async()=>{
 const c=await imported,h=new c.FrameHistory();
 assert.ok(h.commit(c.update(h.current,'b4',{height:.99})));
 assert.equal(h.current.revision,1);
 assert.equal(h.undo(),true);assert.equal(h.current.revision,0);
 assert.equal(h.redo(),true);assert.equal(h.current.revision,1);
 assert.equal(h.original.revision,0);
 const copy=structuredClone(h.current);
 assert.deepEqual(c.seedVariation(copy,12),c.seedVariation(copy,12));
 const v=h.save();assert.equal(v.id,'A');
 assert.equal(h.variants[0].frame.revision,1);
});
test('duration changes bound safely, and invalid notes are never accepted',async()=>{
 const c=await imported,f=c.starter();
 const length=c.update(f,'b4',{duration:9});
 assert.equal(length.notes.find(x=>x.id==='b4').duration,1.45);
 const negative=c.update(f,'b4',{height:-500});
 assert.equal(negative.notes.find(x=>x.id==='b4').height,0);
 assert.throws(()=>c.update(f,'nonexistent',{height:.8}));
});
test('separate new experience references local free audio and no extra services',async()=>{
 const dir=path.resolve(__dirname,'../public/instrument/frame');
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 const ui=fs.readFileSync(path.join(dir,'ui.mjs'),'utf8');
 assert.match(html,/Music, through interaction/);
 assert.match(html,/form-canvas/);assert.match(html,/START LISTENING/);
 assert.match(html,/\/instrument\/studio-bass-v5.js/);
 assert.match(ui,/history\.commit/);assert.match(ui,/audio\.queue/);
 assert.match(ui,/pointerdown/);assert.match(ui,/compareOriginal/);
 assert.ok(!ui.includes('API_KEY'));
});
