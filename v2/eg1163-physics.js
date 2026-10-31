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
function eg1163Transient(s,{seconds=1,runningCurrent=.008,initialVcc=12,temperature=25,initialEnabled=true}={}){
 const fs=s.fs,dt=1/fs,steps=Math.min(650000,Math.ceil(seconds*fs)),stride=Math.max(1,Math.floor(steps/6000)),points=[],events=[];
 let vout=s.target,vcc=initialVcc,i=Math.min(s.load,10),run=vcc>8,enabled=initialEnabled,integral=0,ocp=false,negativeCut=false,lastState='';
 for(let n=0;n<=steps;n++){let t=n*dt,requested=(s.constantLoad??s.load)+vout*(s.loadConductance??0),load=t<.02?Math.min(requested,10):requested,thermal=eg1163Thermal({vcc,upper:s.enUpper,series:s.enSeries,r25:s.ntcR25,beta:3950,temp:temperature,enabled});enabled=thermal.enabled;
  if(run&&vcc<=8){run=false;integral=0}else if(!run&&vcc>=16.5)run=true;
  let active=run&&enabled,d=0,high=Math.max(0,(.18-vcc*s.r6/s.r32)/s.sense),neg=eg1163NegativeThreshold(s.rds,s.r10,s.antiR),onSlope=(s.vin-vout-i*s.sense)/s.L;
  if(active){integral=Math.max(-.5,Math.min(.5,integral+40*(s.target-vout)*dt));d=Math.max(.05,Math.min(.95,s.target/s.vin+.02*(s.target-vout)+integral-.006*(i-load)));ocp=i+onSlope*d*dt>=high;if(ocp)d=.05}else ocp=false;
  let start=i,pk=active?i+onSlope*d*dt:i,decay=(vout+i*(s.rds+s.sense))/s.L,end=pk-decay*(1-d)*dt;
  negativeCut=active&&end<-neg.trip;if(!active)end=Math.max(0,i-(vout+.7+Math.max(i,0)*s.sense)/s.L*dt);else if(negativeCut){let reached=(pk+neg.trip)/Math.max(decay,1e-9),remaining=Math.max(0,(1-d)*dt-reached);end=Math.min(0,-neg.trip+(s.vin-vout)/s.L*remaining)}
  if(!Number.isFinite(end)||Math.abs(end)>100){events.push({t,state:'超出100A数值演示范围，终止计算'});break}i=end;let avg=active?(.5*(start+pk)*d+.5*(pk+i)*(1-d)):.5*(start+i);vout=Math.max(0,Math.min(s.vin,vout+(avg-load)*dt/s.C));
  let startCurrent=(s.vin-vcc)/s.startR,supply=Math.max(0,(vout-.7-vcc)/s.supplyR),draw=active?runningCurrent:.0002;vcc=Math.max(0,Math.min(20,vcc+(startCurrent+supply-draw)*dt/s.vccCap));
  let state=!enabled?'EN过温关闭':!run?'VCC欠压关断 / 启动电阻充电':ocp?'高端过流 / 5%最小脉宽':'正常PWM';if(state!==lastState){if(events.length<1000)events.push({t,state,vcc,vout});lastState=state}
  if(n%stride===0)points.push({t,vout,vcc,i:avg,valley:i,peak:pk,duty:d,ocp,run:active,negativeCut,en:thermal.en,state});
 }
 return {points,events,seconds:points.at(-1)?.t??seconds,chargeTime:eg1163ChargeTime({vin:s.vin,resistance:s.startR,cap:s.vccCap}),assumptions:{runningCurrent,loadStep:.02,controller:'简化PI及阻尼，仅用于保护趋势'}};
}
