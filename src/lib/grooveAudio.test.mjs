import test from 'node:test';
import assert from 'node:assert/strict';
import {pcm16Wav} from './grooveAudio.mjs';
test('WAV export correctly encodes RIFF 16-bit mono and sample values',async()=>{
 const b=pcm16Wav(new Float32Array([-1,0,1]),22050);
 const bytes=await b.arrayBuffer(),d=new DataView(bytes),s=(n,k)=>String.fromCharCode(...new Uint8Array(bytes,n,k));
 assert.equal(b.type,'audio/wav');assert.equal(s(0,4),'RIFF');assert.equal(s(8,4),'WAVE');
 assert.equal(s(12,4),'fmt ');assert.equal(s(36,4),'data');
 assert.equal(d.getUint32(4,true),42);assert.equal(d.getUint16(20,true),1);
 assert.equal(d.getUint16(22,true),1);assert.equal(d.getUint32(24,true),22050);
 assert.equal(d.getUint16(34,true),16);assert.equal(d.getUint32(40,true),6);
 assert.equal(d.getInt16(44,true),-32768);assert.equal(d.getInt16(48,true),32767);
});
