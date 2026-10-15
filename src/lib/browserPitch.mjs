// OFFBEAT browser periodicity estimation. No model or network.
// YIN-style cumulative-mean-normalized difference (CMND) with minimum selection.
// This remains an uncalibrated frequency estimate, never a note identification.
const MIN_HZ=36,MAX_HZ=650,WINDOW=1024;
export function estimateFundamental(samples, center, sampleRate=11025) {
  const minLag=Math.max(2,Math.floor(sampleRate/MAX_HZ));
  const maxLag=Math.ceil(sampleRate/MIN_HZ);
  const usable=WINDOW-maxLag;
  if(samples.length<WINDOW+maxLag||usable<=0)return null;
  const start=Math.min(Math.max(0,Math.floor(center-WINDOW/2)),samples.length-WINDOW-maxLag);
  const differences=new Float64Array(maxLag+1);
  // Constant window length across candidate lags avoids artificially favoring
  // short lags due to varying sample counts. Stride trades resolution for CPU.
  for(let lag=1;lag<=maxLag;lag++){
    let sum=0;
    for(let i=0;i<usable;i+=3){
      const delta=samples[start+i]-samples[start+i+lag];
      sum+=delta*delta;
    }
    differences[lag]=sum;
  }
  let running=0,first=null,best=null;
  const cmnd=new Float64Array(maxLag+1);
  for(let lag=1;lag<=maxLag;lag++){
    running+=differences[lag];
    cmnd[lag]=running>1e-10?differences[lag]*lag/running:1;
  }
  // The first clear local valley is preferred over a later octave harmonic.
  // Periodic bass overtones can produce false half-period minima; reject
  // them when the second period is materially clearer.
  for(let lag=minLag+1;lag<maxLag;lag++){
    const score=cmnd[lag];
    if(score>cmnd[lag-1]||score>cmnd[lag+1])continue;
    const candidate={lag,score};
    if(!best||score<best.score)best=candidate;
    if(!first&&score<.19)first=candidate;
  }
  let chosen=first||best;
  if(!chosen||chosen.score>.25)return null;
  if(first&&2*first.lag<=maxLag){
    let octave=null;
    const middle=2*first.lag;
    for(let lag=Math.max(minLag,middle-3);lag<=Math.min(maxLag,middle+3);lag++){
      if(!octave||cmnd[lag]<octave.score)octave={lag,score:cmnd[lag]};
    }
    if(octave&&octave.score<first.score*.72)chosen=octave;
  }
  const lag=chosen.lag;
  const a=cmnd[lag-1]??cmnd[lag],b=cmnd[lag],c=cmnd[lag+1]??cmnd[lag];
  const denom=a-2*b+c;
  const shift=Math.abs(denom)>1e-8?Math.max(-.5,Math.min(.5,.5*(a-c)/denom)):0;
  const frequency=sampleRate/(lag+shift);
  if(!Number.isFinite(frequency)||frequency<MIN_HZ||frequency>MAX_HZ)return null;
  const periodicity=Math.max(0,Math.min(1,1-chosen.score));
  return {hz:frequency,periodicity};
}
