const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'../public/instrument');
const bank=fs.readFileSync(path.join(base,'studio-bass-samples-v5.js'),'utf8');
const engine=fs.readFileSync(path.join(base,'studio-bass-v5.js'),'utf8');
const context={window:{},Uint8Array,Float32Array,Math,Number,WeakMap};
vm.runInNewContext(bank+'\n'+engine,context);
const v=context.window.OffbeatStudioBass;
test('licensed studio electric bass roots are on-site and correctly declared',()=>{
 const assets=context.window.OffbeatStudioBassSamples;
 const keys=Object.keys(assets);
 assert.equal(keys.length,5);
 for(const name of ['E2','G2','As2','Cs3','E3'])assert.ok(assets[name].length>200000,name);
 assert.match(bank,/CC BY 3.0/);assert.match(bank,/Karoryfer/);
});
test('eight touch notes choose nearest recorded bass source, with bounded playback rates',()=>{
 for(const f of v.notes){
  const map={E2:1,G2:1,As2:1,Cs3:1,E3:1};
  const source=v.choose(f,map);
  assert.ok(source);
  assert.ok(source.rate>.72&&source.rate<1.24,String(f)+' rate='+source.rate);
 }
});
test('v5 wiring retains earlier FORM recording versions and sampled export',()=>{
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
 assert.ok(html.indexOf('studio-bass-samples-v5.js')<html.indexOf('studio-bass-v5.js'));
 assert.match(html,/instrument:'studio-v5'/);
 assert.match(html,/\[1,2,3,4,5\]\.includes\(saved\.version\)/);
 assert.match(html,/studioBass\.preload\(c\)/);
 assert.match(html,/studioBass\.play\(ctx/);
 assert.match(html,/id="kick"/);assert.match(html,/id="snare"/);
});
