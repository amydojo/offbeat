import { analyzePCM } from '../lib/browserFeatures.mjs';
self.onmessage = ({data}) => {
 try {
  const result=analyzePCM({...data.options,samples:new Float32Array(data.samples)});
  self.postMessage({id:data.id,result});
 } catch(error) {self.postMessage({id:data.id,error:error?.message||'Analysis failed'});}
};
