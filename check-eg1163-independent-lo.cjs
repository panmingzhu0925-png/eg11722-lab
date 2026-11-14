const fs=require('fs'),assert=require('assert');
const prefix=fs.readFileSync('check-eg1163.cjs','utf8').split('\nassert.equal')[0],env=new Function('require',prefix+';return env')(require),r=env.run;
for(const frequency of [55000,72000,150000])for(const control of [1.8,2.8,5]){
 r(`dead=200e-9*${frequency};control=${control};ratio=Math.max(0,Math.min(1,(Math.min(control,4.4)-EG1163_CP.low)/EG1163_CP.span));q={fs:${frequency},erro:control,ss:4.4,maxDutyMode:ratio>=.95,run:true,duty:Math.max(0,Math.min(.95,ratio)-dead),loStart:Math.min(.95,ratio),cutPhase:1-dead};normal=eg1163GateEdges(q);limited=eg1163GateEdges({...q,ocp:true,duty:Math.min(q.duty,.05-dead)});`);
 assert(r('Math.abs(normal.loStart-limited.loStart)<1e-12 && Math.abs(normal.loWidth-limited.loWidth)<1e-12'));
 assert(r('limited.hoWidth<=.05-dead+1e-12'));
 assert(r('Array.from({length:10000},(_,i)=>i/10000).every(p=>!(eg1163GateHigh(p,limited.hoStart,limited.hoWidth)&&eg1163GateHigh(p,limited.loStart,limited.loWidth)))'));
}
r("loadPreset();s=extractCircuit();p={...s,fs:72000,cp:200,ssCap:100e-12,target:1.2*(1+s.rt/s.rb),L:s.ind*1e-6,C:s.cap*1e-6,sense:s.rs/1000,esr:s.esr/1000,supplyMode:'independent',fixedVcc:16.5,ampConfig:{gainDb:75,gbw:0,outputUa:20}};result=eg1163Transient(p,{seconds:.003,initialState:{vout:0,vcc:16.5,i:25,run:true,enabled:true,enV:5,ss:4.4}});ocpCycles=result.cycles.filter(q=>q.ocp&&q.erro>EG1163_CP.low&&q.ss>EG1163_CP.low)");
assert(r('ocpCycles.length>0'));
assert(r('ocpCycles.every(q=>{let ratio=Math.max(0,Math.min(1,(Math.min(q.erro,q.ss)-EG1163_CP.low)/EG1163_CP.span));return Math.abs(q.loStart-Math.min(.95,ratio,q.loEnd))<1e-12})'));
console.log('PASS: HO OCP limitation leaves LO comparator timing unchanged at 55/72/150kHz; no overlap; transient LO start follows comparator.');

for(const frequency of [55000,72000,150000])for(const ratio of [.94,.949999,.95,.950001,.97,.99,.999999,1]){
 r(`fsTest=${frequency};ratioTest=${ratio};dead=200e-9*fsTest;q={fs:fsTest,erro:EG1163_CP.low+ratioTest*EG1163_CP.span,ss:4.4,duty:.05-dead,ocp:true,maxDutyMode:false,cutPhase:1-dead};edge=eg1163GateEdges(q)`);
 assert(r("edge.loWidth>=.05-dead-1e-12"),"LO minimum missing near CP peak");
 assert(r("Array.from({length:10000},(_,i)=>i/10000).every(p=>!(eg1163GateHigh(p,edge.hoStart,edge.hoWidth)&&eg1163GateHigh(p,edge.loStart,edge.loWidth)))"));
}
console.log("PASS LO minimum 5% minus dead time across CP peak boundary, independent of HO OCP");
for(const frequency of [55000,72000,150000])for(const ocp of [false,true]){
 r(`fsTest=${frequency};dead=200e-9*fsTest;seq=[.9498,.9499,.9501,.9502,.9501,.9499].map((ratio,n)=>({t:(n+1)/fsTest,fs:fsTest,run:true,vcc:14,erro:EG1163_CP.low+ratio*EG1163_CP.span,ss:4.4,maxDutyMode:ratio>=.95,ocp:${ocp},duty:${ocp}?.05-dead:Math.min(.95,ratio)-dead,cutPhase:1-dead}));timings=seq.map((q,n)=>n+eg1163GateEdges(q).hoStart);measurement=eg1163MeasurePWM(seq,0,6/fsTest,'HO')`);
 assert(r('timings.slice(1).every((t,n)=>Math.abs(t-timings[n]-1)<.0001)'), 'HO phase discontinuity across saturation');
 assert(r('Math.abs(measurement.frequency/fsTest-1)<.0001'), 'false MHz reading');
 // Sample adjacent records, including period boundaries, to count actual displayed rises.
 r('rises=[];initialEdge=eg1163GateEdges(seq[0]);last=eg1163GateHigh(0,initialEdge.hoStart,initialEdge.hoWidth);for(let n=0;n<60000;n++){let t=n/10000,k=Math.floor(t),q=seq[k],e=eg1163GateEdges(q),high=eg1163GateHigh(t-k,e.hoStart,e.hoWidth);if(high&&!last)rises.push(t);last=high}');
 assert(r('rises.slice(1).every((t,n)=>t-rises[n]>.99)'), 'adjacent spurious HO pulses');
}
console.log('PASS adjacent-period HO continuity and sampled rising edges across 95% in both directions, normal/OCP; frequency follows oscillator');
