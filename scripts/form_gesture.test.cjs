const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path'),fs=require('node:fs');
const load=async()=>import(pathToFileURL(path.resolve(__dirname,'../public/instrument/gesture/physics.mjs')).href);
const core=async()=>import(pathToFileURL(path.resolve(__dirname,'../public/instrument/frame/core.mjs')).href);

test('pulls map signed vertical, horizontal, tension, speed and starting position',async()=>{
 const v=await load(),u=v.sampleGesture({originX:.4,dx:80,dy:-85,elapsed:240,travel:.8});
 assert.ok(u.ny>.45);assert.ok(u.nx>.45);assert.ok(u.tension>.5);
 assert.equal(u.originX,.4);assert.ok(u.speed>=0&&u.speed<=1);
 const lower=v.sampleGesture({originX:1.5,dx:-100,dy:85,elapsed:100});
 assert.ok(lower.ny<0&&lower.nx<0);assert.equal(lower.originX,1);
});
test('a release reshapes neighboring notes, shifts duration, alters energy and keeps original intact',async()=>{
 const c=await core(),v=await load(),old=c.starter();
 const anchor=v.chooseAnchor(old,.52),oldCenter=old.notes.find(x=>x.id===anchor);
 const g=v.sampleGesture({originX:.52,dx:90,dy:-110,elapsed:250,travel:2});
 const after=v.applyGesture(old,g,anchor);
 assert.ok(c.validate(after));
 const updated=after.notes.find(x=>x.id===anchor);
 assert.ok(updated.height>oldCenter.height);
 assert.ok(updated.duration>oldCenter.duration);
 assert.ok(updated.velocity>=oldCenter.velocity);
 assert.ok(after.notes.some(x=>x.id!==anchor&&x.height!==old.notes.find(a=>a.id===x.id).height));
 assert.deepEqual(old,c.starter());
 assert.equal(after.gestureMemory.length,1);
 assert.equal(after.gestureMemory[0].anchor,anchor);
});
test('gesture compiles real bass, harmonic response and audibly new rhythm accent',async()=>{
 const c=await core(),v=await load(),old=c.starter(),target='b4';
 const raw={...v.sampleGesture({originX:.5,dx:130,dy:-100,elapsed:155,travel:2}),tension:.85,speed:.96};
 const after=v.applyGesture(old,raw,target);
 const beforeScore=v.compilePhysical(old),score=v.compilePhysical(after);
 assert.ok(score.physicalResponses.length>0,'No generated rhythmic release');
 assert.ok(score.physicalResponses.some(x=>x.derivedFromIds.includes(target)));
 assert.notEqual(beforeScore.bass.find(x=>x.sourceId===target).frequency,score.bass.find(x=>x.sourceId===target).frequency);
 assert.notEqual(beforeScore.harmony.find(x=>x.sourceId===target).frequency,score.harmony.find(x=>x.sourceId===target).frequency);
 assert.ok(score.events.length>beforeScore.events.length);
 assert.equal(score.events.length,score.bass.length+score.harmony.length+score.drums.length);
 assert.ok(score.events.every(x=>x.time>=0&&x.time<score.duration));
 assert.deepEqual(score,v.compilePhysical(after),'Non deterministic response');
});
test('spring settles after release with finite damping and stationary origin',async()=>{
 const v=await load();
 let p={x:0,y:0,vx:0,vy:0};
 for(let i=0;i<14;i++)p=v.physicsStep(p,{held:true,x:.75,y:-.55},1/60);
 assert.ok(p.x>.30&&p.y<-.22);
 const held={...p};
 for(let i=0;i<170;i++)p=v.physicsStep(p,{held:false,x:0,y:0},1/60);
 assert.ok(Math.abs(p.x)<.006&&Math.abs(p.y)<.006,JSON.stringify({held,p}));
});
test('light touches do not generate extra rhythmic accents',async()=>{
 const v=await load(),c=await core(),f=c.starter();
 const g=v.sampleGesture({originX:.48,dx:4,dy:-5,elapsed:300});
 const after=v.applyGesture(f,g,v.chooseAnchor(f,.48));
 assert.equal(v.compilePhysical(after).physicalResponses.length,0);
});
test('standalone physical instrument is free, local, and uses FORM relationship engine',async()=>{
 const dir=path.resolve(__dirname,'../public/instrument/gesture');
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8'),app=fs.readFileSync(path.join(dir,'app.mjs'),'utf8');
 assert.match(html,/FORM 009/);assert.match(html,/id="sculpture"/);
 assert.match(html,/\/instrument\/studio-bass-v5\.js/);
 assert.match(html,/BEFORE \/ AFTER/);
 assert.match(app,/applyGesture/);assert.match(app,/audio\.sculpt/);
 assert.match(app,/audio\.previewChange/);
 assert.match(app,/history\.commit/);
 assert.match(app,/localStorage/);
 assert.ok(!app.includes('API_KEY'));
});
