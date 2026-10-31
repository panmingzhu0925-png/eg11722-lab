// User-confirmed EG1163 behavior. Timing/plant assumptions are explicit UI parameters.
function eg1163Thermal({vcc,upper,series,r25,beta=3950,temp,enabled=true}){
 const resistance=r25*Math.exp(beta*(1/(temp+273.15)-1/298.15)),bottom=series+resistance,voltage=sink=>(vcc/upper-sink)/(1/upper+1/bottom);
 if(enabled&&voltage(0)<1.2)enabled=false;else if(!enabled&&voltage(18e-6)>=1.2)enabled=true;
 const threshold=sink=>{let bottom=1.2*upper/(vcc-1.2-sink*upper),r=bottom-series;return r>0&&vcc>1.2+sink*upper?1/(1/298.15+Math.log(r/r25)/beta)-273.15:null};
 return {enabled,en:Math.max(0,voltage(enabled?0:18e-6)),sink:enabled?0:18e-6,resistance,tripTemp:threshold(0),recoverTemp:threshold(18e-6)};
}
function eg1163NegativeThreshold(rds,r10,rpull,reference=4.9){let sense=.18-(rpull?((reference-.18)*r10/rpull):0);return {trip:Math.max(0,sense/rds),inhibited:sense<0,sense}}
function eg1163ThermalDivider({vcc,r25=100000,beta=3950,trip,recover}){if(![vcc,r25,beta,trip,recover].every(Number.isFinite)||vcc<=1.2||r25<=0||beta<=0||recover<=-273.15||trip<=recover)throw Error('关断温度须高于恢复温度，且VCC>1.2V');let r=t=>r25*Math.exp(beta*(1/(t+273.15)-1/298.15)),hot=r(trip),cold=r(recover),delta=cold-hot,series=(-(hot+cold)+Math.sqrt(delta*delta+4*1.2*delta/18e-6))/2,upper=(vcc-1.2)*(series+hot)/1.2;if(series<=0||upper<=0)throw Error('该组温度目标在当前NTC参数下需要负电阻，不能实现');return {upper,series}}
function eg1163SyncCycle({vin,vout,L,fs,mean,negativeTrip=Infinity,inhibited=false}){
 const m=vout/vin,delta=(vin-vout)*m/(L*fs),low=mean-delta/2,peak=mean+delta/2;
 if(!inhibited&&low>=-negativeTrip)return {d:m,off:1-m,low,peak,dcm:false,cut:1,backEnd:1,i:p=>p<m?low+(vin-vout)*p/(L*fs):peak-vout*(p-m)/(L*fs),sw:p=>p<m?vin:0};
 let neg=inhibited?0:negativeTrip,slope=(vin-vout)/(L*fs),fall=vout/(L*fs),profile=d=>{let pk=slope*d,off=(pk+neg)/fall,back=neg/slope,avg=.5*pk*d+.5*(pk-neg)*off-.5*neg*back;return {d,off,back,pk,avg}},a=0,b=m;
 for(let n=0;n<40;n++){let mid=(a+b)/2;if(profile(mid).avg>mean)b=mid;else a=mid}let q=profile((a+b)/2),cut=q.d+q.off,end=cut+q.back;
 return {d:q.d,off:q.off,low:-neg,peak:q.pk,dcm:true,cut,backEnd:end,i:p=>p<q.d?slope*p:p<cut?q.pk-fall*(p-q.d):p<end?-neg+slope*(p-cut):0,sw:p=>p<q.d?vin:p<cut?0:p<end?vin:vout};
}
function eg1163ChargeTime({vin,resistance,cap,from=8,to=16.5,standby=.0002}){let final=vin-standby*resistance;return final<=to?Infinity:resistance*cap*Math.log((final-from)/(final-to))}
function eg1163Magnetics(L,isat){if(!(isat>0))return {flux:i=>L*i,current:f=>f/L};let knee=isat*Math.pow(3.6,.25),kneeFlux=L*(knee-.05*knee**5/isat**4);return {flux:i=>{let a=Math.abs(i);return Math.sign(i)*(a<knee?L*(a-.05*a**5/isat**4):kneeFlux+.1*L*(a-knee))},current:f=>{let a=Math.abs(f);if(a>=kneeFlux)return Math.sign(f)*(knee+(a-kneeFlux)/(.1*L));let lo=0,hi=knee;for(let n=0;n<22;n++){let m=(lo+hi)/2;if(L*(m-.05*m**5/isat**4)<a)lo=m;else hi=m}return Math.sign(f)*(lo+hi)/2}}}
function eg1163Transient(s,{seconds=1,runningCurrent=.008,initialVcc=12,temperature=25,initialEnabled=true,initialState=null,diodeDrop=.7}={}){
 const fs=s.fs,dt=1/fs,steps=Math.min(650000,Math.ceil(seconds*fs)),stride=Math.max(1,Math.floor(steps/6000)),points=[],cycles=[],events=[],mag=eg1163Magnetics(s.L,s.isat);
 let vout=initialState?.vout??s.target,vcc=initialState?.vcc??initialVcc,i=initialState?.i??Math.min(s.load,10),run=initialState?.run??(vcc>8),enabled=initialState?.enabled??initialEnabled,integral=initialState?.integral??0,minNext=initialState?.minNext??false,ocp=false,negativeCut=false,lastState='';
 points.push({t:0,vout,vcc,i,valley:i,peak:i,duty:run&&enabled?.2:0,ocp:false,run:run&&enabled,negativeCut:false,en:0,state:run&&enabled?'运行初始状态':!enabled?'EN关闭初始状态':'启动充电初始状态',temperature});
 for(let n=0;n<steps;n++){let t=(n+1)*dt,requested=(s.constantLoad??s.load)+vout*(s.loadConductance??0),load=!initialState&&t<.02?Math.min(requested,10):requested,thermal=eg1163Thermal({vcc,upper:s.enUpper,series:s.enSeries,r25:s.ntcR25,beta:3950,temp:temperature,enabled});enabled=thermal.enabled;
  let wasRun=run;if(run&&vcc<=8){run=false;integral=0;minNext=false}else if(!run&&vcc>=16.5)run=true;if(run!==wasRun)points.push({t:t-dt,vout,vcc,i,valley:i,peak:i,duty:0,ocp:false,run:run&&enabled,negativeCut:false,en:thermal.en,state:run?'VCC达16.5V，PWM启动':'VCC低于8V，PWM关闭',temperature});
  let active=run&&enabled,d=0,high=Math.max(0,(.18-vcc*s.r6/s.r32)/s.sense),neg=eg1163NegativeThreshold(s.rds,s.r10,s.antiR),onVoltage=s.vin-vout-i*s.sense,onSlope=onVoltage/s.L;
  if(active){integral=Math.max(-.5,Math.min(.5,integral+40*(s.target-vout)*dt));d=Math.max(.05,Math.min(.95,s.target/s.vin+.02*(s.target-vout)+integral-.006*(i-load)));if(minNext){d=.05;ocp=true;minNext=false}else{ocp=mag.current(mag.flux(i)+onVoltage*d*dt)>=high;if(ocp){d=Math.max(.05,Math.min(d,(mag.flux(high)-mag.flux(i))/Math.max(onVoltage*dt,1e-12)));minNext=true}}}else ocp=false;
  let startVout=vout;let start=i,pk=active?mag.current(mag.flux(i)+onVoltage*d*dt):i,offVoltage=vout+i*(s.rds+s.sense),decay=offVoltage/s.L,end=mag.current(mag.flux(pk)-offVoltage*(1-d)*dt);
  negativeCut=active&&end<-neg.trip;if(!active)end=Math.max(0,mag.current(mag.flux(i)-(vout+.7+Math.max(i,0)*s.sense)*dt));else if(negativeCut){let reached=(mag.flux(pk)-mag.flux(-neg.trip))/Math.max(offVoltage,1e-9),remaining=Math.max(0,(1-d)*dt-reached);end=Math.min(0,mag.current(mag.flux(-neg.trip)+(s.vin-vout)*remaining))}
  if(!Number.isFinite(end)||Math.abs(end)>100){events.push({t,state:'超出100A数值演示范围，终止计算'});break}i=end;let avg=active?(.5*(start+pk)*d+.5*(pk+i)*(1-d)):.5*(start+i);if(s.isat>0&&active){let area=(a,b)=>.5*(mag.current(a+(b-a)*.2113248654)+mag.current(a+(b-a)*.7886751346));avg=area(mag.flux(start),mag.flux(pk))*d+area(mag.flux(pk),mag.flux(i))*(1-d)}vout=Math.max(0,Math.min(s.vin,vout+(avg-load)*dt/s.C));
  let startCurrent=(s.vin-vcc)/s.startR,supply=Math.max(0,(vout-diodeDrop-vcc)/s.supplyR),draw=active?runningCurrent:.0002;vcc=Math.max(0,Math.min(20,vcc+(startCurrent+supply-draw)*dt/s.vccCap));
  let state=!enabled?'EN过温关闭':!run?'VCC欠压关断 / 启动电阻充电':ocp?'高端过流 / 5%最小脉宽':'正常PWM';if(state!==lastState){if(events.length<1000)events.push({t,state,vcc,vout});lastState=state}
  let record={t,vin:s.vin,fs:s.fs,L:s.L,isat:s.isat??0,onVoltage,offVoltage,C:s.C,esr:s.esr??.03,startVout,target:s.target,loadCurrent:load,pout:vout*load,vout,vcc,i:avg,startI:start,valley:i,peak:pk,duty:d,ocp,run:active,negativeCut,negativeTrip:neg.trip,loInhibited:neg.inhibited,cutPhase:negativeCut?Math.max(d,Math.min(1,d+(mag.flux(pk)-mag.flux(-neg.trip))/Math.max(offVoltage*dt,1e-12))):1,en:thermal.en,state,temperature};cycles.push(record);if(n%stride===0||n===steps-1)points.push(record);
 }
 return {points,cycles,events,seconds:points.at(-1)?.t??seconds,chargeTime:eg1163ChargeTime({vin:s.vin,resistance:s.startR,cap:s.vccCap}),finalState:{vout,vcc,i,run,enabled,integral,minNext},assumptions:{runningCurrent,loadStep:.02,controller:'简化PI及阻尼，仅用于保护趋势'}};
}

function eg1163SteadyVcc({vin,vout,startR,supplyR,runningCurrent=.008,diodeDrop=.7}){let standalone=vin-runningCurrent*startR,v=standalone>=vout-diodeDrop?standalone:(vin/startR+(vout-diodeDrop)/supplyR-runningCurrent)/(1/startR+1/supplyR);return Math.max(0,Math.min(20,v))}
function eg1163FindEdge(points,source,level,edge,after=0){for(let n=1;n<points.length;n++){let a=points[n-1],b=points[n];if(b.t<after)continue;let va=source(a),vb=source(b);if(edge==='fall'?va>=level&&vb<level:va<=level&&vb>level){let t=a.t+(b.t-a.t)*(level-va)/(vb-va);if(t>=after)return {t,index:n}}}return null}
