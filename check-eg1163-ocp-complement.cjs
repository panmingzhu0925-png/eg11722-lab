const fs=require('fs'),assert=require('assert');
const prefix=fs.readFileSync('check-eg1163.cjs','utf8').split('\nassert.equal')[0],env=new Function('require',prefix+';return env')(require),r=env.run;
for(const frequency of [55000,72000,150000]){
 r(`dead=200e-9*${frequency};q={fs:${frequency},erro:5,ss:4.4,maxDutyMode:true,run:true,duty:.95-dead,loStart:.95,cutPhase:1-dead};normal=eg1163GateEdges(q);limited=eg1163GateEdges({...q,ocp:true,duty:.05-dead,loStart:.05,cutPhase:1-dead});negative=eg1163GateEdges({...q,ocp:true,negativeCut:true,duty:.05-dead,loStart:.05,cutPhase:.10})`);
 assert(r('Math.abs(normal.hoWidth-(.95-dead))<1e-12'));
 assert(r('Math.abs(normal.loWidth-(.05-dead))<1e-12'));
 assert(r('Math.abs(limited.hoWidth-(.05-dead))<1e-12'));
 assert(r('Math.abs(limited.loWidth-(.95-dead))<1e-12'));
 assert(r('Math.abs(limited.loStart-limited.hoEnd-dead)<1e-12'));
 assert(r('Math.abs(1-limited.loEnd+limited.hoStart-dead)<1e-12'));
 assert(r('negative.loWidth<limited.loWidth'));
 assert(r('Array.from({length:10000},(_,i)=>i/10000).every(p=>!(eg1163GateHigh(p,limited.hoStart,limited.hoWidth)&&eg1163GateHigh(p,limited.loStart,limited.loWidth)))'));
}
r("loadPreset();s=extractCircuit();p={...s,fs:72000,cp:200,ssCap:100e-12,target:1.2*(1+s.rt/s.rb),L:s.ind*1e-6,C:s.cap*1e-6,sense:s.rs/1000,esr:s.esr/1000,supplyMode:'independent',fixedVcc:16.5,ampConfig:{gainDb:75,gbw:0,outputUa:20}};result=eg1163Transient(p,{seconds:.003,initialState:{vout:0,vcc:16.5,i:25,run:true,enabled:true,enV:5,ss:4.4}});ocpCycles=result.cycles.filter(q=>q.ocp&&q.erro>EG1163_CP.low&&q.ss>EG1163_CP.low)");
assert(r('ocpCycles.length>0'));
assert(r('ocpCycles.every(q=>Math.abs(q.loStart-q.duty-200e-9*q.fs)<1e-12)'));
assert(r('ocpCycles.every(q=>Math.abs(eg1163GateEdges(q).loStart-eg1163GateEdges(q).hoEnd-200e-9*q.fs)<1e-12)'));
console.log('PASS normal95/5, OCP5/95 with both200ns dead times; no overlap; negative-current cutoff retained; actual transient records match gate edges');
