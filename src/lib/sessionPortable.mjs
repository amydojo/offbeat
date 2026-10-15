import {validGroove} from './grooveEngine.mjs';
// OFFBEAT portable session backups. All work is local; no fetch/upload.
// This is intentionally bounded for phone memory, not a cloud sync format.
const BACKUP_VERSION='offbeat.backup.v1';
const MAX_AUDIO_BYTES=12*1024*1024;
const MAX_JSON_BYTES=20*1024*1024;
const allowedKinds=new Set(['solo_bass','humming','separated_stem','mixed_reference']);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function hex(buffer){return Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,'0')).join('');}
async function sha256(bytes){return hex(await crypto.subtle.digest('SHA-256',bytes));}
function encodeBase64(bytes){
 const size=32768,parts=[];
 for(let i=0;i<bytes.length;i+=size){
  const portion=bytes.subarray(i,i+size);
  parts.push(String.fromCharCode(...portion));
 }
 return btoa(parts.join(''));
}
function decodeBase64(text){
 if(typeof text!=='string'||text.length>MAX_JSON_BYTES||text.length%4!==0||
  !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))
  throw new Error('This project contains invalid encoded audio.');
 const decoded=atob(text),bytes=new Uint8Array(decoded.length);
 for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
 return bytes;
}
function audioFileSize(clip){return clip?.blob?.size??0;}
function validExcerpt(clip){
 const start=clip?.excerptStart??clip?.excerpt_start_s??0;
 const full=clip?.fullDuration??clip?.full_duration_s??null;
 if(!finite(start)||start<0||(full!==null&&(!finite(full)||full<=0||full>3600))||
  (clip?.analysis&&start+clip.analysis.source.duration_s>(full??clip.analysis.source.duration_s)+.05))
  throw new Error('The backup has invalid source excerpt timing.');
 return {start,full};
}
function validSelection(s){
 if(!s||!finite(s.start)||!finite(s.end)||s.start<0||s.end<=s.start||s.end>60.001)
  throw new Error('The backup has an invalid phrase selection.');
}
function validateAnalysis(a,sha) {
 if(a===null)return;
 if(!a||a.schema_version!=='offbeat.phrase.v1'||a.source?.sha256!==sha||
    !allowedKinds.has(a.source?.kind)||
    !finite(a.source?.duration_s)||a.source.duration_s<=0||a.source.duration_s>60||
    !Array.isArray(a.pitch_frames)||a.pitch_frames.length>12000||
    !Array.isArray(a.onsets)||a.onsets.length>2000||
    !Array.isArray(a.rests)||a.rests.length>1000||
    typeof a.analysis_id!=='string')
   throw new Error('The backup audio and its musical analysis do not match.');
}
async function pack(clip){
 if(!clip)return null;
 const blob=clip.blob;
 if(!(blob instanceof Blob)||blob.size===0)throw new Error('A saved audio file is missing.');
 const {start,full}=validExcerpt(clip);
 const bytes=new Uint8Array(await blob.arrayBuffer());
 const hash=await sha256(bytes);
 validateAnalysis(clip.analysis??null,hash);
 return {
  name:String(clip.name||'original-audio').slice(0,160),
  mime:String(clip.mime||blob.type||'application/octet-stream').slice(0,128),
  size:bytes.byteLength,sha256:hash,base64:encodeBase64(bytes),
  analysis:clip.analysis??null,
  excerpt_start_s:start,full_duration_s:full
 };
}
async function unpack(clip) {
 if(clip===null)return null;
 if(!clip||typeof clip!=='object'||typeof clip.name!=='string'||
  clip.name.length<1||clip.name.length>160||
  typeof clip.mime!=='string'||clip.mime.length>128||
  !Number.isInteger(clip.size)||clip.size<=0||clip.size>MAX_AUDIO_BYTES||
  !/^[a-f0-9]{64}$/.test(clip.sha256||''))
  throw new Error('The backup has invalid audio metadata.');
 const bytes=decodeBase64(clip.base64);
 if(bytes.byteLength!==clip.size||(await sha256(bytes))!==clip.sha256)
  throw new Error('The backup failed audio integrity verification.');
 validateAnalysis(clip.analysis??null,clip.sha256);
 const {start,full}=validExcerpt(clip);
 const file=new File([bytes],clip.name,{type:clip.mime});
 return {file,name:clip.name,analysis:clip.analysis??null,excerptStart:start,fullDuration:full};
}
export async function createSessionBackup(entry){
 if(!entry||entry.schema_version!=='offbeat.session.v1')
  throw new Error('Choose a saved OFFBEAT phrase before exporting.');
 validSelection(entry.selection);
 const total=audioFileSize(entry.reference)+audioFileSize(entry.take);
 if(total<=0||total>MAX_AUDIO_BYTES)
  throw new Error('Mobile project backups support up to 12 MB of original audio. Use Download original for larger recordings.');
 const payload={
  schema_version:BACKUP_VERSION,
  exported_at:new Date().toISOString(),
  session:{
   title:String(entry.title||'Untitled phrase').slice(0,90),
   created_at:String(entry.createdAt||''),
   selection:{start:entry.selection.start,end:entry.selection.end},
   reference:await pack(entry.reference),
   take:await pack(entry.take),
   comparison:entry.comparison??null,
   groove:entry.groove&&entry.take?.analysis&&validGroove(entry.groove,entry.take.analysis)?entry.groove:null
  }
 };
 if(!payload.session.reference?.analysis&&!payload.session.take?.analysis)
  throw new Error('Analyze a recording before exporting a project.');
 const json=JSON.stringify(payload);
 if(new Blob([json]).size>MAX_JSON_BYTES)
  throw new Error('The project is too large to safely export on a phone.');
 return json;
}
export async function parseSessionBackup(file){
 if(!(file instanceof Blob)||file.size>MAX_JSON_BYTES||file.size===0)
  throw new Error('Choose a valid OFFBEAT backup under 20 MB.');
 let data;
 try {data=JSON.parse(await file.text());}
 catch {throw new Error('This file is not a readable OFFBEAT project.');}
 if(data?.schema_version!==BACKUP_VERSION||!data.session||
  typeof data.session.title!=='string'||data.session.title.length>90)
  throw new Error('Unsupported OFFBEAT backup version or invalid project header.');
 const session=data.session;
 validSelection(session.selection);
 const sizes=(session.reference?.size||0)+(session.take?.size||0);
 if(sizes>MAX_AUDIO_BYTES)throw new Error('The project contains more than 12 MB of audio.');
 const reference=await unpack(session.reference??null);
 const take=await unpack(session.take??null);
 if(!reference?.analysis&&!take?.analysis)
  throw new Error('This project has no analyzed recordings.');
 let comparison=session.comparison??null;
 if(comparison&&(
  comparison.schema_version!=='offbeat.compare.v1'||
  comparison.reference_analysis_id!==reference?.analysis?.analysis_id||
  comparison.take_analysis_id!==take?.analysis?.analysis_id
 ))comparison=null;
 return {
  title:session.title||'Imported phrase',
  reference,take,selection:{start:session.selection.start,end:session.selection.end},
  comparison,
  groove:session.groove&&take?.analysis&&validGroove(session.groove,take.analysis)?session.groove:null
 };
}
export async function downloadSessionBackup(entry){
 const json=await createSessionBackup(entry);
 const slug=String(entry.title||'phrase').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)||'phrase';
 const name=slug+'.offbeat.json';
 const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
 const anchor=document.createElement('a');
 anchor.href=url;anchor.download=name;anchor.style.display='none';
 document.body.appendChild(anchor);
 try {anchor.click();}
 finally{
  anchor.remove();
  // Keep the object URL alive for Safari's asynchronous download handling.
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
 return name;
}
