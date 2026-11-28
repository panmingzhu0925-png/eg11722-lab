// V2 additions shared by every chip adapter. Snapshots keep only current/previous.
(function(){
const taxonomy={DCDC:{'异步降压':['EG11722'],'同步降压':['EG1163'],'同步升压':[]},ACDC:{'反激':[],'正激':['EG12523'],'半桥':[],'LLC':[],'PFC':['EG1654']}};
const chipField=document.getElementById('chipSelect'),currentChip=chipField.value||((typeof CHIP_STORAGE_PREFIX==='string'&&/^(eg1654|eg12523)/.test(CHIP_STORAGE_PREFIX))?'EG1654':'EG11722');let currentFamily=['EG1654','EG12523'].includes(currentChip)?'ACDC':'DCDC';const category=document.createElement('select'),topology=document.createElement('select');category.id='chipCategory';topology.id='chipTopology';category.setAttribute('aria-label','产品类别');topology.setAttribute('aria-label','电路类型');for(let field of [category,topology]){field.style.cssText='padding:9px;border:1px solid #cad7e2;border-radius:6px;margin-right:6px';chipField.before(field)}
category.innerHTML=Object.keys(taxonomy).map(x=>`<option value="${x}">${x}</option>`).join('');category.value=currentFamily;
function fillChips(navigate){let models=taxonomy[category.value][topology.value];chipField.innerHTML=models.map(x=>`<option value="${x}">${x}</option>`).join('');chipField.value=models.includes(currentChip)?currentChip:models[0];if(navigate&&chipField.value!==currentChip)chipField.onchange({target:chipField})}
function fillTopology(navigate){let group=taxonomy[category.value];topology.innerHTML=Object.entries(group).map(([x,models])=>`<option value="${x}" ${models.length?'':'disabled'}>${x}${models.length?'':'（暂无芯片）'}</option>`).join('');topology.value=Object.keys(group).find(k=>group[k].includes(currentChip))||Object.keys(group).find(k=>group[k].length);fillChips(navigate)}
category.onchange=()=>fillTopology(true);topology.onchange=()=>fillChips(true);fillTopology(false);
document.getElementById('chipSelect').onchange=e=>{const chosen=e.target.value;category.value=currentFamily;fillTopology(false);if(parent!==window){parent.postMessage({type:'eg-v2-chip',chip:chosen},location.origin==='null'?'*':location.origin)}else location.href=chosen+'.html'};
const pfc=typeof CHIP_STORAGE_PREFIX==='string'&&/^(eg1654|eg12523)/.test(CHIP_STORAGE_PREFIX),wave=document.getElementById(pfc?'pfcWave':'wave');
let previous=null,current=null,revision='',timer=null,pendingRevision=null,overlayEnabled=true;const parameterRevision=()=>JSON.stringify({parts:currentChip==='EG12523'?circuit.parts.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>!['x','y','angle','vertical','mirrorX','mirrorY','labelPosition','labelLayout','labelOffsets','refdes'].includes(key)))):circuit.parts.map(p=>[p.id,p.value,p.capKind,p.isat,p.rds]),wires:circuit.wires,controls:['esr','eff','freqLine','variant','junctionTemp','vcc1163','cp1163','rds1163','runCurrent1163','diodeDrop1163'].map(id=>document.getElementById(id)?.readOnly?undefined:document.getElementById(id)?.value)});
const tools=document.createElement('div');tools.style.cssText='padding:12px 20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap';tools.innerHTML='<button id="compareToggle">上一次波形：显示</button><button id="compareClear">清除对比</button><span id="compareInfo" style="font-size:12px;color:#b6cce0">修改参数后自动保留上一次；虚线为上一次。</span>';wave.before(tools);
const autoX=document.createElement('button');autoX.textContent='横坐标自适应';autoX.onclick=()=>{if(!pfc&&typeof window.getChipAutoTimeWindow==='function'){buckScopeWindow=window.getChipAutoTimeWindow();update();return}if(pfc){if(fullTrace()){let end=pfcLast.switchTrace.t.at(-1),span=pfcTime==='line'?end:10/pfcLast.s.fs;pfcScopeWindow={start:pfcTime==='line'?0:Math.max(0,end-span),span}}else pfcScopeWindow={start:pfcTime==='line'?0:1/(4*Number(document.getElementById('freqLine').value)),span:pfcTime==='line'?1/Number(document.getElementById('freqLine').value):10/Number(document.getElementById('variant').value)}}else buckScopeWindow={start:0,span:10/(typeof syncFrequency==='number'?syncFrequency:110000)};update()};tools.append(autoX);for(let id of ['autoYAxes','resetAxes']){let button=document.getElementById(id);if(button)tools.append(button)}
for(let id of ['scopeTimeScale','rippleScale','timeScale','phase','currentRange','rippleRange','visibleCycles','axisXMin','axisXMax','axisYGroup','axisYMin','axisYMax','scopeTool']){let input=document.getElementById(id);let label=input?.closest?.('label');if(label)label.hidden=true}
for(let id of ['moreCycles','fewerCycles','applyAxes','timeWindow']){let element=document.getElementById(id);if(element)element.hidden=true}document.querySelectorAll('.scope .tools').forEach(row=>{if([...row.children].every(child=>child.hidden))row.hidden=true});
const edgeBox=document.createElement('span');edgeBox.style.cssText='display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap';edgeBox.innerHTML='<label>沿触发 <select id="commonEdgeChannel" aria-label="触发通道"></select></label><select id="commonEdgeDirection"><option value="rise">上升沿</option><option value="fall">下降沿</option></select><input id="commonEdgeLevel" type="number" value="0" step="any" style="width:65px" title="触发电平，单位与所选通道相同"><button id="commonEdgeArm">单次沿触发</button><span id="commonEdgeStatus" style="font-size:12px"></span>';tools.append(edgeBox);let edgeMark=null,edgeList='',edgeEnabled=!(currentChip==='EG12523'&&document.getElementById('forwardScopeBar'));
function scopeGroupTop(a,index,row=185,top=28){return a.groups[index]?.top??index*row+top}
function scopeGroupHeight(group){return group?.height??140}
function traceUnit(id){if(pfc&&typeof pfcScopeAxes!=='undefined'){let g=pfcScopeAxes?.groups.find(g=>g.ids?.includes(id));if(g)return g.unit}return pfc?({VAC:'V',VG:'V',VO:'V',VDS:'V',IL:'A',IAC:'A',IOUT:'A',POUT:'W',DRV:'V·驱动',VC:'V·控制',VM:'V·控制',VR:'V·AC'}[id]):({I:'A',T:'A',P:'W',N:'V',S:'V',O:'V',V:'mV',H:'V·驱动',K:'V·驱动',B:'V·驱动'}[id])}
function refreshEdge(){edgeBox.hidden=currentChip==='EG1163'||!edgeEnabled;edgeBox.style.display=edgeBox.hidden?'none':'inline-flex';let lines=traces(),key=lines.map(t=>t.id).join('|'),select=document.getElementById('commonEdgeChannel');if(key!==edgeList){let selected=select.value;select.innerHTML=lines.map(t=>`<option value="${t.id}">${t.id} / ${traceUnit(t.id)}</option>`).join('');select.value=lines.some(t=>t.id===selected)?selected:lines[0]?.id??'';edgeList=key}document.getElementById('commonEdgeArm').disabled=!lines.length;wave.querySelectorAll('.edge-marker').forEach(n=>n.remove());let a=axes();if(edgeMark&&a&&!edgeBox.hidden){let x=(pfc?80:75)+(edgeMark.t-a.start)/a.span*(pfc?885:895);if(x>=75&&x<=970){let n=document.createElementNS('http://www.w3.org/2000/svg','path');for(let [k,v]of Object.entries({class:'edge-marker',d:`M${x} 15V${(a.bottom??a.groups.length*(pfc?185:190)-10)}`,stroke:'#ffb66d','stroke-dasharray':'4 4','pointer-events':'none'}))n.setAttribute(k,v);wave.append(n)}}}
if(currentChip==='EG12523')wave.addEventListener('forward-edge-toggle',event=>{edgeEnabled=event.detail;if(!edgeEnabled){edgeMark=null;document.getElementById('commonEdgeStatus').textContent=''}refreshEdge()});
document.getElementById('commonEdgeArm').onclick=()=>{if(!edgeEnabled)return;let a=axes(),id=document.getElementById('commonEdgeChannel').value,line=traces().find(t=>t.id===id),level=Number(document.getElementById('commonEdgeLevel').value),direction=document.getElementById('commonEdgeDirection').value||'rise';if(!a||!line||!Number.isFinite(level))return;let index=a.groups.findIndex(g=>g.unit===traceUnit(id));if(index<0)return;let g=a.groups[index],left=pfc?80:75,width=pfc?885:895,row=pfc?185:190,top=pfc?28:35,points=fullTrace()&&forwardTraceSVG.fields[id]?forwardTracePoints(pfcLast.switchTrace,id,a.start,a.span):line.points.split(' ').map(pt=>{let [x,y]=pt.split(',').map(Number);return {t:a.start+(x-left)/width*a.span,v:g.min+(scopeGroupTop(a,index,row,top)+scopeGroupHeight(g)-y)/scopeGroupHeight(g)*(g.max-g.min)}}),found=null;for(let n=1;n<points.length;n++){let before=points[n-1],after=points[n];if(direction==='fall'?before.v>=level&&after.v<level:before.v<=level&&after.v>level){found={t:before.t+(after.t-before.t)*(level-before.v)/(after.v-before.v)};break}}if(!found){document.getElementById('commonEdgeStatus').textContent='当前窗口无此沿，请调整电平或扩大时间窗';return}edgeMark=found;let windowRange={start:Math.max(0,found.t-a.span*.2),span:a.span};if(pfc)pfcScopeWindow=windowRange;else buckScopeWindow=windowRange;update();document.getElementById('commonEdgeStatus').textContent='已触发 t='+(found.t*1000).toFixed(4)+'ms';};
function fullTrace(){return pfc&&typeof pfcLast!=='undefined'&&pfcLast?.fullTransient&&pfcLast.switchTrace}
function traces(){return [...wave.querySelectorAll(fullTrace()?'polyline[data-channel],path[data-channel]':'polyline[data-channel]')].filter(n=>!n.closest('.previous-wave')).map(n=>({id:n.dataset.channel,points:n.getAttribute('points')||'',color:n.getAttribute('stroke'),unit:traceUnit(n.dataset.channel)}))}
function axes(){return pfc?pfcScopeAxes:buckScopeAxes}
function capture(){let a=axes();return a?{native:!!fullTrace(),switchTrace:fullTrace()||null,fs:fullTrace()?pfcLast.s.fs:null,live:!!window.eg1163ProtectionView,traces:traces(),start:a.start,span:a.span,groups:a.groups.map(g=>({unit:g.unit,min:g.min,max:g.max,top:g.top,height:g.height}))}:null}
function paint(){wave.querySelectorAll('.previous-wave').forEach(n=>n.remove());if(!overlayEnabled||!previous)return;let a=axes();if(!a)return;if(previous.native&&fullTrace()){for(let trace of previous.traces){let index=a.groups.findIndex(g=>g.unit===trace.unit);if(index<0)continue;let g=a.groups[index],root=document.createElementNS('http://www.w3.org/2000/svg','g');root.setAttribute('class','previous-wave');root.setAttribute('opacity','.45');if(forwardTraceSVG.fields[trace.id]){root.innerHTML=forwardTraceSVG(previous.switchTrace,trace.id,a.start,a.span,scopeGroupTop(a,index),(scopeGroupTop(a,index)+scopeGroupHeight(g)),g.min,g.max,trace.color,index,previous.fs).replace(/ data-channel="[^"]*"/g,'');root.querySelectorAll('path,polyline').forEach(p=>p.setAttribute('stroke-dasharray','6 4'))}else if(trace.points){let oldIndex=previous.groups.findIndex(x=>x.unit===trace.unit),old=previous.groups[oldIndex],points=trace.points.split(' ').map(pt=>{let [x,y]=pt.split(',').map(Number),t=previous.start+(x-80)/885*previous.span,v=old.min+((scopeGroupTop(previous,oldIndex)+scopeGroupHeight(old))-y)/scopeGroupHeight(old)*(old.max-old.min);return (80+(t-a.start)/a.span*885)+','+((scopeGroupTop(a,index)+scopeGroupHeight(g))-(v-g.min)/(g.max-g.min)*scopeGroupHeight(g))}).join(' '),line=document.createElementNS('http://www.w3.org/2000/svg','polyline');for(let [key,value]of Object.entries({points,fill:'none',stroke:trace.color,'stroke-width':1.5,'stroke-dasharray':'6 4','clip-path':'url(#pfcClip'+index+')'}))line.setAttribute(key,value);root.append(line)}wave.append(root)}return}let left=pfc?80:75,width=pfc?885:895,row=pfc?185:190,top=pfc?28:35;for(let trace of previous.traces){let oldIndex=previous.groups.findIndex(g=>pfc?({VAC:'V',VG:'V',VO:'V',IL:'A',IAC:'A',IOUT:'A',POUT:'W',VDS:'V',DRV:'V·驱动',VC:'V·控制',VM:'V·控制',VR:'V·AC'}[trace.id]===g.unit):({I:'A',T:'A',P:'W',VOUT:'V',VCC:'V',REF:'V',CP:'V',ERRO:'V',EN:'V',VIN:'V',SW:'V',IL:'A',IOUT:'A',POUT:'W',AC:'mV',HO:'驱动/V',LO:'驱动/V',B:'V·驱动',H:'V·驱动',K:'V·驱动',N:'V',S:'V',O:'V',V:'mV'}[trace.id]===g.unit));if(oldIndex<0)continue;let old=previous.groups[oldIndex],index=a.groups.findIndex(g=>g.unit===old.unit);if(index<0)continue;let g=a.groups[index],points=trace.points.split(' ').map(pt=>{let [x,y]=pt.split(',').map(Number),t=(previous.live&&window.eg1163ProtectionView?a.start:previous.start)+(x-left)/width*previous.span,value=old.min+(scopeGroupTop(previous,oldIndex,row,top)+scopeGroupHeight(old)-y)/scopeGroupHeight(old)*(old.max-old.min);return `${left+(t-a.start)/a.span*width},${scopeGroupTop(a,index,row,top)+scopeGroupHeight(g)-(value-g.min)/(g.max-g.min)*scopeGroupHeight(g)}`}).join(' '),n=document.createElementNS('http://www.w3.org/2000/svg','polyline');for(let [k,v]of Object.entries({class:'previous-wave',points,fill:'none',stroke:trace.color,'stroke-width':1.5,'stroke-dasharray':'6 4',opacity:.55,'pointer-events':'none','clip-path':`url(#${pfc?'pfcClip':'scopeClip'}${index})`}))n.setAttribute(k,v);wave.append(n)}}
const hint=document.createElement('p');hint.style.cssText='padding:0 14px;font-size:12px;color:#667b8e';hint.textContent='双击可计算节点选择电压波形；双击电感或负载选择电流波形。';document.getElementById('editor').parentElement.after(hint);
const oldUpdate=update;update=function(){let next=parameterRevision();oldUpdate();refreshEdge();if(next!==revision){if(next!==pendingRevision){clearTimeout(timer);pendingRevision=next;timer=setTimeout(()=>{if(current&&revision!==next)previous=current;current=capture();revision=next;pendingRevision=null;paint()},300)}}else{current=capture();paint()}};
document.getElementById('compareToggle').onclick=()=>{overlayEnabled=!overlayEnabled;document.getElementById('compareToggle').textContent='上一次波形：'+(overlayEnabled?'显示':'隐藏');paint()};document.getElementById('compareClear').onclick=()=>{clearTimeout(timer);previous=null;current=capture();revision=parameterRevision();paint()};
// Double-click terminals selects an available voltage channel; inductor/load symbols select current.
document.getElementById('editor').addEventListener('dblclick',e=>{let pin=e.target.closest('[data-pin]'),part=e.target.closest('[data-part]'),id=pin?.dataset.pin?.split('.')[0]??part?.dataset.part,p=circuit.parts.find(p=>p.id===id);if(!p||!pin)return;if(typeof eg1163Probe==='function'&&window.selectEG1163Channel){let channel=eg1163Probe(pin?.dataset.pin,p);if(channel){window.selectEG1163Channel(channel);wave.scrollIntoView({behavior:'smooth',block:'center'});return}}let key=pin?.dataset.pin??(p.type==='J'?p.id+'.a':null),parent={},find=k=>parent[k]===undefined?(parent[k]=k):parent[k]===k?k:parent[k]=find(parent[k]);for(let w of circuit.wires)parent[find(w[0])]=find(w[1]);let references=currentChip==='EG12523'?{'L1.b':'VO','LOAD.a':'VO','DB1.p':'VG','Q2.D':'VDS','U1.OUT':'DRV','U1.HO':'VC','U1.LO':'VM','U1.VIN':'VIN','U1.VCC':'VCC','U1.CS':'CS','U1.FB':'FB','U1.SS':'SS'}:pfc?{'D1.b':'VO','DB1.p':'VG','Q1.D':'VDS','U2.DRV':'DRV','U2.VC':'VC','U2.VM':'VM'}:{'VIN.a':'N','L1.b':'O','U1.VS':'S','U1.VCC':'B','U1.HO':'H','U1.LO':'K'};let channel=p.type==='L'?(pfc?'IL':'I'):p.id==='LOAD'?(pfc?'IOUT':'T'):pfc&&p.type==='A'?'VAC':!pfc&&p.id==='VIN'?'N':key?Object.entries(references).find(([k])=>find(k)===find(key))?.[1]:p.type==='C'&&['C2','C3'].includes(p.id)?(pfc?'VO':'O'):null;if(!channel){document.getElementById('editorHelp').textContent='此节点尚未提供可计算波形。';return}if(pfc){pfcActive.add(channel);if(typeof forwardRevealChannel==='function')forwardRevealChannel(channel);if(channel==='DRV')document.getElementById('timeSwitch').onclick();document.querySelector(`[data-channel="${channel}"]`)?.classList.add('active')}else{activeChannels.add(channel);document.getElementById('w'+channel)?.classList.add('active')}update();wave.scrollIntoView({behavior:'smooth',block:'center'})});
const names={VAC:'交流输入',VG:'整流电压',VO:'输出电压',VDS:'MOS漏源电压',IL:'电感电流',IAC:'输入电流',IOUT:'负载电流',POUT:'负载功率',DRV:'MOS驱动',VC:'控制电压',VM:'VM',VR:'输出纹波',I:'电感电流',T:'负载电流',P:'负载功率',N:'输入电压',S:'开关节点',O:'输出电压',V:'输出纹波',H:'HO−VS',K:'LO−COM',B:'VCC'};
if(currentChip==='EG12523'&&typeof forwardExtraDefs==='function')Object.assign(names,Object.fromEntries(Object.entries(forwardExtraDefs()).map(([id,d])=>[id,d.label])));
if(currentChip==='EG12523')Object.assign(names,{VIN:'VIN控制供电',VCC:'VCC驱动供电',FB:'FB',SS:'SS',CS:'CS',IM:'励磁电流',IAC:'下管IDS',VC:'HO−VS',VM:'LO−PGND'});
const cursorToggle=document.createElement('button'),cursorControls=document.createElement('span'),cursorReadout=document.createElement('div'),cursorChannel=document.createElement('select');cursorToggle.textContent='光标：关';if(currentChip==='EG12523')cursorToggle.dataset.forwardCursorToggle='';cursorChannel.setAttribute('aria-label','光标测量通道');cursorControls.style.cssText='display:none;gap:8px;align-items:center';cursorReadout.style.cssText='padding:6px 20px;color:#bdd0df;font-size:12px;line-height:1.8';tools.append(cursorToggle,cursorControls);wave.after(cursorReadout);let channelLabel=document.createElement('span');channelLabel.textContent='信号通道';cursorChannel.style.cssText='min-width:130px;max-width:210px;height:30px;padding:3px 6px;background:#fff;color:#162b40;border:1px solid #7592aa;border-radius:4px;font-size:12px';cursorControls.append(channelLabel,cursorChannel);let cursorEnabled=false,cursorAxis='x',cursorPositions=[1/3,2/3],cursorValues=[0,1],hoverFraction=null,cursorDrag=null,channelList='';
const axisButtons={};for(let axis of ['x','y']){let button=document.createElement('button');button.title=axis==='x'?'时间测量：垂直光标':'幅值测量：水平光标';button.setAttribute('aria-label',button.title);button.innerHTML=axis==='x'?'<svg width="22" height="18" style="width:22px;height:18px;min-height:0;max-height:18px;display:inline-block" viewBox="0 0 28 22" aria-hidden="true"><path d="M8 2V20" stroke="currentColor" stroke-width="2"/><path d="M20 2V20" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/></svg>':'<svg width="22" height="18" style="width:22px;height:18px;min-height:0;max-height:18px;display:inline-block" viewBox="0 0 28 22" aria-hidden="true"><path d="M2 6H26" stroke="currentColor" stroke-width="2"/><path d="M2 17H26" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/></svg>';button.style.cssText='width:36px;height:30px;min-height:0;padding:4px;display:inline-flex;align-items:center;justify-content:center';button.onclick=()=>{cursorAxis=axis;resetY();decorate()};axisButtons[axis]=button;cursorControls.append(button)}
function engineeringMeasure(v,kind){if(!Number.isFinite(v))return '—';let abs=Math.abs(v),scale=kind==='Hz'?(abs>=1e6?[1e6,'MHz']:abs>=1000?[1000,'kHz']:[1,'Hz']):(abs>=1?[1,'s']:abs>=.001?[.001,'ms']:abs>=1e-6?[1e-6,'µs']:[1e-9,'ns']);return Number((v/scale[0]).toPrecision(5))+' '+scale[1]}
const forwardCursor = currentChip === 'EG12523' && Boolean(document.getElementById('forwardScopeBar'));
let hoverY = null;
function resetY(){let a=axes(),g=a?.groups.find(g=>g.unit===channelUnit(cursorChannel.value));if(g)cursorValues=[g.min+(g.max-g.min)/3,g.min+(g.max-g.min)*2/3]}
function legacyScopeButtons() {
  const selector = currentChip === 'EG1654' ? 'button[data-channel]' :
    window.eg1163ProtectionView ? 'button[data-live-channel]' : 'button[id^="w"]';
  return [...wave.closest('.scope').querySelectorAll(selector)]
    .filter(button => !button.hidden && !button.disabled);
}
function scopeChannelId(button) {
  return button.dataset.waveChannel ?? button.dataset.liveChannel ?? button.dataset.channel ?? button.id.slice(1);
}
function selectCursorChannel() {
  if (forwardCursor && cursorEnabled && cursorChannel.value &&
      !axes()?.groups.some(group => group.ids.includes(cursorChannel.value))) {
    forwardRevealChannel(cursorChannel.value);
    update();
  } else if (cursorEnabled && !forwardCursor) {
    const button = legacyScopeButtons().find(button => scopeChannelId(button) === cursorChannel.value);
    if (button && !button.classList.contains('active')) button.click();
  }
  resetY();
  decorate();
}
cursorToggle.onclick = () => {
  cursorEnabled = !cursorEnabled;
  cursorToggle.textContent = cursorEnabled ? '光标：开' : '光标：关';
  cursorControls.style.display = cursorEnabled ? 'inline-flex' : 'none';
  selectCursorChannel();
};
cursorChannel.onchange = selectCursorChannel;
function channelUnit(id){return window.liveScopeChannels?.[id]?.unit??traceUnit(id)}
function channelName(id){return window.liveScopeChannels?.[id]?.label??names[id]??id}
function valuesAt(t){let a=axes();if(!a)return [];if(fullTrace()){let q=pfcLast.sample(t),values={DRV:q.drv,VC:q.vc,VM:q.vm,VIN:q.vin,VCC:q.vcc,FB:q.fb,SS:q.ss,CS:q.cs,IM:q.im,VO:q.vo,VG:q.vg,VAC:q.vac,IL:q.il,IAC:q.ids,IOUT:q.iout,POUT:q.pout,VR:q.vr,VDS:q.vds};if(typeof forwardExtraDefs==='function')for(let [id,d]of Object.entries(forwardExtraDefs()))values[id]=d.value(q);return traces().filter(line=>Number.isFinite(values[line.id])).map(line=>({id:line.id,label:channelName(line.id),color:line.color,value:values[line.id],unit:traceUnit(line.id)}))}let left=pfc?80:75,width=pfc?885:895,row=pfc?185:190,top=pfc?28:35;return traces().map(line=>{let index=a.groups.findIndex(g=>g.unit===channelUnit(line.id));if(index<0)return '';let g=a.groups[index],pts=line.points.trim().split(/\s+/).map(v=>v.split(',').map(Number)),x=left+(t-a.start)/a.span*width;if(!pts.length||x<pts[0][0]||x>pts.at(-1)[0])return '';let n=pts.findIndex(pt=>pt[0]>=x);if(n<0)return '';let q=pts[n],before=pts[Math.max(0,n-1)],y=before[1]+(q[1]-before[1])*(q[0]===before[0]?0:(x-before[0])/(q[0]-before[0])),value=g.min+(scopeGroupTop(a,index,row,top)+scopeGroupHeight(g)-y)/scopeGroupHeight(g)*(g.max-g.min);return {id:line.id,label:channelName(line.id),color:line.color,value,unit:g.unit}}).filter(Boolean)}
function readAt(t){return valuesAt(t).map(q=>`<span style="color:${q.color}">${q.label} ${Number(q.value.toPrecision(4))} ${q.unit}</span>`).join(' · ')}

let forwardCursorSummary = forwardCursor ? document.getElementById('forwardCursorSummary') : null;
const traceSegments = new WeakMap();

function cursorTraceSegments(node) {
  if (traceSegments.has(node)) return traceSegments.get(node);
  const segments = [];
  let x, y;
  const points = node.getAttribute('points');
  if (points) {
    for (const point of points.trim().split(/\s+/)) {
      const [nextX, nextY] = point.split(',').map(Number);
      if (Number.isFinite(x) && Number.isFinite(nextX) && Number.isFinite(nextY) && Number.isFinite(y)) {
        segments.push([x, y, nextX, nextY]);
      }
      x = nextX;
      y = nextY;
    }
  } else {
    const number = '[-+]?(?:\\d*\\.\\d+|\\d+)(?:e[-+]?\\d+)?';
    const command = new RegExp('([MLVh])(' + number + ')(?:[ ,]+(' + number + '))?', 'gi');
    for (const [, kind, first, second] of (node.getAttribute('d') ?? '').matchAll(command)) {
      const nextX = kind === 'V' ? x : kind === 'h' ? x + Number(first) : Number(first);
      const nextY = kind === 'V' ? Number(first) : kind === 'h' ? y : Number(second);
      if (kind !== 'M' && [x,y,nextX,nextY].every(Number.isFinite)) segments.push([x,y,nextX,nextY]);
      x = nextX;
      y = nextY;
    }
  }
  traceSegments.set(node, segments);
  return segments;
}

function cursorLabelCoversCurve(box, traces) {
  const minX = box.x - 2, maxX = box.x + box.width + 2;
  const minY = box.y - 2, maxY = box.y + box.height + 2;
  for (const trace of traces) {
    for (const [x1,y1,x2,y2] of cursorTraceSegments(trace)) {
      if (x2 < minX || x1 > maxX) continue;
      const start = x2 === x1 ? y1 : y1 + (y2-y1) * Math.max(0,(minX-x1)/(x2-x1));
      const end = x2 === x1 ? y2 : y1 + (y2-y1) * Math.min(1,(maxX-x1)/(x2-x1));
      if (Math.max(start,end) >= minY && Math.min(start,end) <= maxY) return true;
    }
  }
  return false;
}

function forwardCursorLabels(group, index, timeAxis, axes, left, width) {
  const {factor, label} = commonScopeUnit(group);
  const channel = cursorChannel.value;
  const format = value => Number.isFinite(value) ? Number((value * factor).toPrecision(5)) + ' ' + label : '—';
  const times = cursorPositions.map(position => axes.start + position * axes.span);
  const values = timeAxis
    ? times.map(time => valuesAt(time).find(trace => trace.id === channel)?.value)
    : cursorValues;
  const deltaTime = Math.abs(times[1] - times[0]);
  const timeText = timeAxis
    ? ' · Δt ' + engineeringMeasure(deltaTime,'s') + (deltaTime ? ' · 1/Δt ' + engineeringMeasure(1/deltaTime,'Hz') : '')
    : '';
  const summary = [channelName(channel) + timeText + ' · ΔY ' + format(values[1]-values[0])];
  const nodes = [...wave.querySelectorAll('[clip-path="url(#' + (pfc?'pfcClip':'scopeClip') + index + ')"]')]
    .filter(node => node.matches('path,polyline'));
  const positions = timeAxis ? cursorPositions.map(p => left + p * width) : values.map(value =>
    group.top + scopeGroupHeight(group) * (1 - (value - group.min) / (group.max - group.min)));
  const placed = [];
  const widthOfLabel = timeAxis ? 162 : 112;
  const heightOfLabel = 23;
  let html = '';

  for (const [index, name] of ['A','B'].entries()) {
    const readout = (timeAxis ? engineeringMeasure(times[index],'s') + ' · ' : '') + format(values[index]);
    const position = positions[index];
    const other = positions[1-index];
    const plotBottom = group.top + scopeGroupHeight(group);
    const right = left + width;
    const beside = [position + 8, position - widthOfLabel - 8];
    if (position - left > right - position) beside.reverse();
    const atY = [group.top+5, (group.top+plotBottom-heightOfLabel)/2, plotBottom-heightOfLabel-5];
    const across = [left+8, right-widthOfLabel-8];
    const candidates = timeAxis
      ? beside.flatMap(x => atY.map(y => ({x,y})))
      : across.flatMap(x => [position-heightOfLabel-6,position+6].map(y => ({x,y})));
    const box = candidates.find(({x,y}) => {
      if (x < left || x+widthOfLabel > right || y < group.top || y+heightOfLabel > plotBottom) return false;
      if (timeAxis ? other >= x-4 && other <= x+widthOfLabel+4 : other >= y-4 && other <= y+heightOfLabel+4) return false;
      if (placed.some(p => x < p.x+widthOfLabel+4 && x+widthOfLabel+4 > p.x &&
          y < p.y+heightOfLabel+4 && y+heightOfLabel+4 > p.y)) return false;
      return !cursorLabelCoversCurve({x,y,width:widthOfLabel,height:heightOfLabel}, nodes);
    });
    if (!box) {
      summary.push(name + ' ' + readout);
      continue;
    }
    placed.push(box);
    html += `<foreignObject data-cursor-card="${name}" x="${box.x}" y="${box.y}" width="${widthOfLabel}" height="${heightOfLabel}" pointer-events="none">
      <div xmlns="http://www.w3.org/1999/xhtml" class="forward-cursor-card"><strong style="color:${index ? '#f284d8' : '#ffd36d'}">${name}</strong> ${readout}</div>
    </foreignObject>`;
  }
  if (forwardCursorSummary) {
    forwardCursorSummary.textContent = summary.join(' ｜ ');
    forwardCursorSummary.hidden = false;
  }
  return html;
}

function scopeCursorMarkers(axes, index, color, x, y, left, width, row, top) {
  const letter = index ? 'B' : 'A';
  if (cursorAxis !== 'x') {
    return `<text data-cursor="${index}" x="${left+8}" y="${y-5}" fill="${color}" font-size="13" pointer-events="all" style="cursor:move">${letter}</text>`;
  }
  const close = Math.abs(cursorPositions[0] - cursorPositions[1]) * width < 26;
  const toLeft = x > left + width - 18 || (close && index === 0 && x > left + 18);
  const stagger = close && (x < left + 18 || x > left + width - 18);
  return axes.groups.map((group, n) => {
    const markerY = scopeGroupTop(axes,n,row,top) + 3 + (stagger && index ? 17 : 0);
    return `<g data-cursor="${index}" data-cursor-row="${n}" style="cursor:ew-resize">
      <path d="M${x-4} ${markerY}h8l-4 5z" fill="${color}" pointer-events="all"/>
      <text x="${x+(toLeft?-6:6)}" y="${markerY+11}" text-anchor="${toLeft?'end':'start'}" fill="${color}" font-size="12" font-weight="700" paint-order="stroke" stroke="#142338" stroke-width="3" pointer-events="all">${letter}</text>
    </g>`;
  }).join('');
}

function decorate(){if(forwardCursorSummary)forwardCursorSummary.hidden=true;wave.querySelectorAll('.scope-decoration').forEach(n=>n.remove());let a=axes();if(!a)return;let lines=traces(),channels=window.eg1163ProtectionView?[...(window.liveScopeSelected??[])].map(id=>({id,color:window.liveScopeChannels[id].color})):lines,choices=forwardCursor?forwardWaveSpecs().flatMap(([, , ,signals])=>signals.map(([id])=>({id}))):legacyScopeButtons().map(button=>({id:scopeChannelId(button)})),key=choices.map(q=>q.id).join('|');for(let q of channels){let button=document.getElementById('w'+q.id);if(button)button.style.color=q.color}if(key!==channelList){let previous=cursorChannel.value;cursorChannel.innerHTML=choices.map(q=>`<option value="${q.id}">${channelName(q.id)}</option>`).join('');cursorChannel.value=choices.some(q=>q.id===previous)?previous:(channels[0]?.id??choices[0]?.id??'');channelList=key;resetY()}for(let axis of ['x','y'])axisButtons[axis].classList.toggle('active',axis===cursorAxis);let root=document.createElementNS('http://www.w3.org/2000/svg','g'),row=pfc?185:190,top=pfc?28:35,left=pfc?80:75,width=pfc?885:895,bottom=a.bottom??a.groups.length*row-10;root.setAttribute('class','scope-decoration');root.setAttribute('pointer-events','none');let html='';if(currentChip!=='EG12523'&&!wave.closest('.common-scope-interface'))a.groups.forEach((g,i)=>{let members=channels.filter(q=>channelUnit(q.id)===g.unit);members.forEach((q,n)=>html+=`<text x="${430+n*530/Math.max(1,members.length)}" y="${scopeGroupTop(a,i,row,top)-10}" fill="${q.color}" font-size="12">${channelName(q.id)}${window.eg1163ProtectionView&&['HO','LO'].includes(q.id)?' · '+(window.eg1163PwmMeasurements?.[q.id]?.frequency?engineeringMeasure(window.eg1163PwmMeasurements[q.id].frequency,'Hz'):'—'):''}</text>`)});if(hoverFraction!==null&&!wave.closest('.scope').classList.contains('hide-forward-guide')){let x=left+hoverFraction*width;const horizontal=hoverY!==null?` M${left} ${hoverY}H${left+width}`: '';html+=`<path data-hover-cursor="true" d="M${x} 15V${bottom}${horizontal}" stroke="#dcebf5" stroke-width="1.5" stroke-dasharray="5 4"/>`}let text='',unit=channelUnit(cursorChannel.value),gIndex=a.groups.findIndex(g=>g.unit===unit),g=a.groups[gIndex];if(cursorEnabled&&g){for(let i=0;i<2;i++){let color=i?'#f284d8':'#ffd36d',x=left+cursorPositions[i]*width,y=scopeGroupTop(a,gIndex,row,top)+scopeGroupHeight(g)-(cursorValues[i]-g.min)/(g.max-g.min)*scopeGroupHeight(g),d=cursorAxis==='x'?`M${x} 15V${bottom}`:`M${left} ${y}H${left+width}`;html+=`<path data-cursor="${i}" d="${d}" stroke="transparent" stroke-width="16" pointer-events="stroke" style="cursor:${cursorAxis==='x'?'ew-resize':'ns-resize'}"/><path d="${d}" stroke="${color}" stroke-width="${cursorDrag===i?2.5:1.5}" ${i?'stroke-dasharray="6 4"':''}/>${scopeCursorMarkers(a, i, color, x, y, left, width, row, top)}`}if(forwardCursorSummary)html+=forwardCursorLabels(g,gIndex,cursorAxis==='x',a,left,width);else if(cursorAxis==='x'){let times=cursorPositions.map(f=>a.start+f*a.span),values=times.map(t=>valuesAt(t).find(q=>q.id===cursorChannel.value)?.value),delta=Math.abs(times[1]-times[0]);text=`${channelName(cursorChannel.value)} · A=${engineeringMeasure(times[0],'s')} · B=${engineeringMeasure(times[1],'s')} · Δt=${engineeringMeasure(delta,'s')} · 1/Δt=${delta?engineeringMeasure(1/delta,'Hz'):'—'}<br>YA=${Number.isFinite(values[0])?Number(values[0].toPrecision(5)):'—'} ${unit} · YB=${Number.isFinite(values[1])?Number(values[1].toPrecision(5)):'—'} ${unit} · ΔY=${values.every(Number.isFinite)?Number((values[1]-values[0]).toPrecision(5)):'—'} ${unit}`}else text=`${channelName(cursorChannel.value)} · A=${Number(cursorValues[0].toPrecision(5))} ${unit} · B=${Number(cursorValues[1].toPrecision(5))} ${unit} · ΔY=${Number((cursorValues[1]-cursorValues[0]).toPrecision(5))} ${unit}`}
root.innerHTML=html;wave.append(root);cursorReadout.innerHTML=(hoverFraction===null||(forwardCursorSummary&&cursorEnabled)?'':`鼠标 ${engineeringMeasure(a.start+hoverFraction*a.span,'s')} · ${readAt(a.start+hoverFraction*a.span)}<br>`)+text}
function installScopeChannelMenu() {
  if (wave.dataset.channelMenuReady) return;
  wave.dataset.channelMenuReady = 'true';
  const menu = document.createElement('div');
  menu.className = 'forward-channel-menu';
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', '波形选择');
  menu.hidden = true;
  const options = ['仅显示此信号', '显示本栏全部信号'].map(text => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    menu.append(button);
    return button;
  });
  const style = document.createElement('style');
  style.textContent = ".forward-channel-menu{position:fixed;left:0;top:0;z-index:1000;display:grid;min-width:155px;padding:4px;background:#182c40;border:1px solid #536981;border-radius:6px;box-shadow:0 6px 18px #0005}\n.forward-channel-menu[hidden]{display:none}\n.forward-channel-menu button{padding:6px 9px;text-align:left;background:transparent;color:#e2eef8;border:0;border-radius:4px;font-size:12px}\n.forward-channel-menu button:is(:hover,:focus-visible){background:#2e5a7e}";
  document.head.append(style);
  document.body.append(menu);
  let selected = null;

  function close(restore = false) {
    if (menu.hidden) return;
    menu.hidden = true;
    if (restore) selected?.button.focus();
  }

  function choose(showAll) {
    if (!selected) return;
    const {id, section, button, controls} = selected;
    if (!section) {
      close();
      for (const channel of controls) {
        if (channel.classList.contains('active') !== (showAll || channel === button)) channel.click();
      }
      button.focus({preventScroll:true});
      return;
    }
    const [key, , , signals] = section;
    for (const [channel] of signals) {
      if (showAll || channel === id) pfcActive.add(channel);
      else pfcActive.delete(channel);
    }
    const state = forwardWaveSettings();
    if (!state.open.includes(key)) state.open.push(key);
    state.selected = [...pfcActive];
    try { localStorage.setItem('eg12523-wave-panels-v2', JSON.stringify(state)); } catch {}
    close();
    update();
    wave.querySelector('[data-wave-channel="' + id + '"]')?.focus({preventScroll:true});
  }

  options[0].addEventListener('click', () => choose(false));
  options[1].addEventListener('click', () => choose(true));
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      options[document.activeElement === options[0] ? 1 : 0].focus();
    }
  });

  const selector = currentChip === 'EG12523' ? '[data-wave-channel]'
    : currentChip === 'EG1654' ? 'button[data-channel]'
    : 'button[data-live-channel], button[id^="w"]';
  const container = wave.closest('.scope');
  container.addEventListener('contextmenu', event => {
    const proxy = event.target.closest('[data-scope-proxy]');
    const button = proxy
      ? legacyScopeButtons().find(control => scopeChannelId(control) === proxy.dataset.scopeProxy)
      : event.target.closest(selector);
    if (!button || button.hidden || button.disabled) return;
    const id = scopeChannelId(button);
    const section = currentChip === 'EG12523'
      ? forwardWaveSpecs().find(([, , , signals]) => signals.some(([channel]) => channel === id))
      : null;
    const unit = channelUnit(id);
    const controls = section ? [] : [...container.querySelectorAll(selector)]
      .filter(control => !control.hidden && !control.disabled && (proxy || control.getClientRects().length) &&
        Boolean(control.dataset.liveChannel) === Boolean(button.dataset.liveChannel) &&
        (control === button || (unit && channelUnit(scopeChannelId(control)) === unit)));
    if (!section && !controls.length) return;
    event.preventDefault();
    selected = {id, section, button, controls};
    menu.hidden = false;
    const bounds = menu.getBoundingClientRect();
    const anchor = (proxy || button).getBoundingClientRect();
    const x = event.clientX || anchor.left;
    const y = event.clientY || anchor.bottom;
    menu.style.left = Math.max(4, Math.min(x, innerWidth - bounds.width - 4)) + 'px';
    menu.style.top = Math.max(4, Math.min(y, innerHeight - bounds.height - 4)) + 'px';
    options[0].focus({preventScroll:true});
  });
  document.addEventListener('pointerdown', event => { if (!menu.contains(event.target)) close(); }, true);
  document.addEventListener('focusin', event => { if (!menu.contains(event.target)) close(); });
  window.addEventListener('scroll', () => close(), true);
  window.addEventListener('resize', () => close());
}

installScopeChannelMenu();

function cursorPoint(e){let p=wave.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(wave.getScreenCTM().inverse())}
wave.addEventListener('pointerdown',e=>{let hit=e.target.closest?.('[data-cursor]');if(!cursorEnabled||!hit||e.button!==0)return;e.preventDefault();e.stopImmediatePropagation?.();cursorDrag=Number(hit.dataset.cursor);wave.setPointerCapture(e.pointerId);decorate()},true);
wave.addEventListener('pointermove',e=>{let a=axes();if(!a)return;let p=cursorPoint(e),left=pfc?80:75,width=pfc?885:895;if(cursorDrag!==null){e.preventDefault();e.stopImmediatePropagation?.();if(cursorAxis==='x')cursorPositions[cursorDrag]=Math.max(0,Math.min(1,(p.x-left)/width));else{let unit=channelUnit(cursorChannel.value),index=a.groups.findIndex(g=>g.unit===unit),g=a.groups[index];if(g)cursorValues[cursorDrag]=g.min+Math.max(0,Math.min(1,1-(p.y-(scopeGroupTop(a,index,pfc?185:190,pfc?28:35)))/scopeGroupHeight(g)))*(g.max-g.min)}decorate();return}const onPlot = !e.target.closest?.('[data-wave-channel],[data-wave-fold],[data-scope-resize],[data-common-resize],[data-scope-proxy]') &&
      a.groups.some((group,index) => {
        const top = scopeGroupTop(a,index,pfc?185:190,pfc?28:35);
        return p.y >= top && p.y <= top + scopeGroupHeight(group);
      });
  hoverFraction=onPlot&&p.x>=left&&p.x<=left+width?(p.x-left)/width:null;
  hoverY=hoverFraction!==null?p.y:null;
  decorate()},true);
for(let event of ['pointerup','pointercancel'])wave.addEventListener(event,e=>{if(cursorDrag===null)return;e.stopImmediatePropagation?.();cursorDrag=null;decorate()},true);wave.addEventListener('pointerleave',()=>{if(cursorDrag===null){hoverFraction=null;hoverY=null;decorate()}});window.decorateScope=decorate;const beforeDecorate=update;update=function(){beforeDecorate();decorate()};
window.refreshScopeComparison=()=>{if(parameterRevision()===revision)current=capture();paint()};revision=parameterRevision();current=capture();refreshEdge();decorate();
const commonPlotHeights = new Map();
if (!forwardCursor) {
  globalThis.layoutCommonScope = groups => {
    let y = 44;
    for (const group of groups) {
      group.top = y;
      group.height = commonPlotHeights.get(group.unit) ?? 140;
      y += group.height + 59;
    }
    return y - 35;
  };
}

function commonScopeUnit(group) {
  const unit = group.axisUnit ?? group.unit;
  const base = unit === '驱动/V' || unit.startsWith('V·') ? 'V' : unit;
  const magnitude = Math.max(Math.abs(group.min),Math.abs(group.max));
  if (magnitude > 0 && magnitude < 1 && ['V','A'].includes(base)) {
    if (magnitude >= .001) return {factor:1e3,label:'m'+base};
    if (magnitude >= .000001) return {factor:1e6,label:'µ'+base};
    return {factor:1e9,label:'n'+base};
  }
  return {factor:1,label:base};
}

function commonScopeYAxis(group, top, left, bottom) {
  const right=left===75?970:965, width=right-left;
  const {factor,label}=commonScopeUnit(group);
  const middle=(top+bottom)/2;
  let svg=`<rect x="12" y="${top-40}" width="976" height="${bottom-top+60}" rx="7" fill="#172a3c" stroke="#334a60"/>
    <rect data-axis-select="y" data-axis-unit="${group.unit}" x="13" y="${top}" width="${left-15}" height="${bottom-top}" fill="transparent" style="cursor:ns-resize"/>
    <text x="38" y="${middle}" transform="rotate(-90 38 ${middle})" text-anchor="middle" dominant-baseline="middle" fill="#bfd3e2" font-size="12" pointer-events="none">${label}</text>`;
  const min=group.min*factor, max=group.max*factor, desired=(max-min)/5;
  if(desired>0 && Number.isFinite(desired)){
    const power=10**Math.floor(Math.log10(desired));
    const step=([1,2,5,10].find(n=>n*power>=desired)??10)*power;
    const digits=Math.max(0,Math.min(12,Math.ceil(-Math.log10(step))));
    const start=Math.ceil(min/step);
    for(let i=0;i<12&&step>0;i++){
      const value=(start+i)*step;
      if(value>max)break;
      const y=bottom-(value-min)/(max-min)*(bottom-top);
      svg+=`<path d="M${left} ${y}H${right}" stroke="#2b3b50"/><text x="${left-9}" y="${y}" dominant-baseline="middle" text-anchor="end" fill="#9fb8cb" font-size="11" pointer-events="none">${Number(value.toFixed(digits))}</text>`;
    }
  }
  const buttons=legacyScopeButtons().filter(button=>channelUnit(scopeChannelId(button))===group.unit);
  const signals=buttons.map(button=>{
    const id=scopeChannelId(button), active=button.classList.contains('active');
    const color=button.style.color || '#bdd5eb';
    return `<button type="button" data-scope-proxy="${id}" aria-pressed="${active}" style="--signal-color:${color}" title="${channelName(id)} · 左键开关，右键选本栏信号">${channelName(id)}</button>`;
  }).join('');
  const handle=bottom+16;
  return svg+`<foreignObject x="22" y="${top-32}" width="948" height="32"><div xmlns="http://www.w3.org/1999/xhtml" class="common-scope-symbols"><b>${label}</b>${signals}</div></foreignObject>
   <rect data-axis-select="x" x="${left}" y="${bottom+1}" width="${width}" height="9" fill="transparent" style="cursor:ew-resize"/>
   <g data-common-resize="${group.unit}" tabindex="0" role="separator" aria-label="调整 ${label} 波形窗高度" aria-valuemin="90" aria-valuemax="540" aria-valuenow="${group.height??140}" style="cursor:ns-resize">
    <rect x="${left}" y="${handle-5}" width="${width}" height="11" fill="transparent"/>
    <path d="M499 ${handle}h48" stroke="#6a8298" stroke-width="3" stroke-linecap="round" pointer-events="none"/>
   </g>`;
}

function installCommonScopeResize() {
  const limit=height=>Math.round(Math.max(90,Math.min(540,height)));
  let drag=null;
  wave.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('[data-common-resize]');
    if(!handle || event.button!==0)return;
    const group=axes()?.groups.find(g=>g.unit===handle.dataset.commonResize);
    if(!group)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const scale=Math.hypot(wave.getScreenCTM().c,wave.getScreenCTM().d);
    drag={handle,group,scale,start:event.clientY,height:group.height??140,pointer:event.pointerId};
    wave.setPointerCapture(event.pointerId);
  },true);
  wave.addEventListener('pointermove',event=>{
    if(!drag || drag.pointer!==event.pointerId)return;
    event.stopImmediatePropagation();
    const base=drag.group.height??140;
    drag.height=limit(base+(event.clientY-drag.start)/drag.scale);
    drag.handle.setAttribute('transform','translate(0 '+(drag.height-base)+')');
  },true);
  const finish=event=>{
    if(!drag || drag.pointer!==event.pointerId)return;
    event.stopImmediatePropagation();
    const {handle,group,height}=drag;
    drag=null;
    handle.removeAttribute('transform');
    if(event.type==='pointerup'&&height!==group.height){
      commonPlotHeights.set(group.unit,height);
      update();
    }
  };
  for(const type of ['pointerup','pointercancel','lostpointercapture'])wave.addEventListener(type,finish,true);
  wave.addEventListener('keydown',event=>{
    const handle=event.target.closest('[data-common-resize]');
    if(!handle||!['ArrowUp','ArrowDown','Home'].includes(event.key))return;
    const group=axes()?.groups.find(g=>g.unit===handle.dataset.commonResize);
    if(!group)return;
    event.preventDefault();
    commonPlotHeights.set(group.unit,event.key==='Home'?140:limit((group.height??140)+(event.key==='ArrowDown'?20:-20)));
    update();
    [...wave.querySelectorAll('[data-common-resize]')].find(node=>node.dataset.commonResize===group.unit)?.focus();
  });
  wave.addEventListener('pointerdown',event=>{
    if(event.target.closest('[data-scope-proxy]'))event.stopImmediatePropagation();
  },true);
  wave.addEventListener('wheel',event=>{
    if(event.shiftKey || event.target.closest('[data-scope-proxy],[data-common-resize]'))return;
    const axis=event.target.closest('[data-axis-select]');
    if(axis?.dataset.axisSelect==='x')return;
    const a=axes();
    if(!a)return;
    const point=cursorPoint(event),left=pfc?80:75;
    const unit=axis?.dataset.axisUnit ?? (point.x>=left&&wave.scopeAxisFocus?.kind==='y'?wave.scopeAxisFocus.unit:null);
    const g=unit?a.groups.find(group=>group.unit===unit):point.x<left?a.groups.find(group=>point.y>=group.top&&point.y<=group.top+group.height):null;
    if(!g)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const ratio=Math.max(0,Math.min(1,1-(point.y-g.top)/g.height));
    const center=g.min+ratio*(g.max-g.min), factor=event.deltaY>0?1.25:.8;
    const limits=pfc?pfcYLimits:buckYLimits;
    limits[g.unit]={min:center-(center-g.min)*factor,max:center+(g.max-center)*factor};
    wave.scopeAxisFocus={kind:'y',unit:g.unit};
    update();
  },{capture:true,passive:false});
  wave.addEventListener('click',event=>{
    const proxy=event.target.closest('[data-scope-proxy]');
    if(!proxy)return;
    const button=legacyScopeButtons().find(button=>scopeChannelId(button)===proxy.dataset.scopeProxy);
    button?.click();
  });
}

function installLegacyScopeInterface() {
  if (forwardCursor) return;
  scopeYAxis=commonScopeYAxis;
  installCommonScopeResize();
  const scope = wave.closest('.scope');
  const style = document.createElement('style');
  style.textContent = ".panel.common-scope-interface{overflow:visible;background:#142338;color:#dce9f5}\n.common-scope-interface .heading{background:#142338}\n.common-scope-bar,.common-scope-options{display:flex;align-items:center;flex-wrap:wrap;gap:4px;padding:6px 12px;background:#1b2d40;border-bottom:1px solid #40566d}\n.common-scope-bar{position:sticky;top:var(--common-scope-top,0px);z-index:19}\n.common-scope-options{position:sticky;top:calc(var(--common-scope-top,0px) + var(--common-scope-bar-height,40px));z-index:18}\n.common-scope-bar button,.common-scope-options :is(button,select,input){box-sizing:border-box;min-height:27px;padding:3px 7px;color:#dce9f5;background:#172738;border:1px solid #536981;border-radius:4px;font-size:12px}\n.common-scope-bar button:is([aria-pressed=true],[aria-expanded=true]),.common-scope-channels button.active{background:#2e6f9f;border-color:#79b3dc}\n.common-scope-interface [hidden]{display:none!important}\n.common-scope-options-inner,.common-scope-channels{display:flex;align-items:center;flex-wrap:wrap;gap:4px}\n.common-scope-range{margin-left:auto;color:#c4d7e7;font-size:11px;font-variant-numeric:tabular-nums}\n.common-scope-interface .heading+.tools:empty{display:none}\n.common-scope-interface #channelButtons:empty{display:none}.common-scope-channels #channelButtons,.common-scope-channels>div{padding:0!important;gap:4px!important;border:0!important} .common-scope-summary{flex-basis:100%;font-size:11px}.common-scope-interface .forward-cursor-card{box-sizing:border-box;padding:2px 5px;white-space:nowrap;border:1px solid #617c95;border-radius:5px;background:#142338ed;color:#e2eef8;font:11px/1.4 Microsoft YaHei,sans-serif}.common-scope-symbols{display:flex;align-items:center;gap:5px;overflow-x:auto;white-space:nowrap;color:#dce9f5;font:12px Microsoft YaHei,sans-serif;padding:0 8px}.common-scope-symbols button{flex:none;padding:4px 7px;background:#1d3044;color:#a0b6ca;border:1px solid #3b526a;border-radius:5px;font-size:12px}.common-scope-symbols button[aria-pressed=true]{border-color:var(--signal-color);color:var(--signal-color);background:#2b4256}.common-scope-symbols b{flex:none;min-width:30px}\n.common-scope-interface .tools:has(>label[hidden]):not(:has(>button:not([hidden]))){display:none}";
  document.head.append(style);
  scope.classList.add('common-scope-interface');

  const bar = document.createElement('div');
  bar.className = 'common-scope-bar';
  bar.setAttribute('role','toolbar');
  bar.setAttribute('aria-label','示波器快捷操作');
  const band = document.createElement('div');
  band.className = 'common-scope-options';
  band.hidden = true;
  const range = document.createElement('output');
  range.className = 'common-scope-range';
  scope.querySelector('.heading').after(bar,band);

  function button(label, action) {
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = label;
    control.addEventListener('click',action);
    bar.append(control);
    return control;
  }

  const byId = id => document.getElementById(id);
  const navigation = byId('scopeTool');
  const steadySource = byId('timeSwitch') || byId('steady1163') || byId('resetAxes');
  const fullSource = byId('timeLine') || byId('process1163');
  const steady = button('稳态波形', () => steadySource?.click());
  if (fullSource) {
    const full = button('全记录', () => fullSource.click());
    bar.prepend(full);
  }
  button('Y 适合', () => byId('autoYAxes')?.click());
  const pan = button('平移', () => { navigation.value='pan'; sync(); });
  const zoom = button('框选', () => { navigation.value='zoom'; sync(); });
  const guide = button('十字线', () => {
    scope.classList.toggle('hide-forward-guide');
    sync();
    decorate();
  });

  const channelOptions = document.createElement('div');
  channelOptions.className = 'common-scope-channels';
  channelOptions.hidden = true;
  const fixedChannels = byId('channelButtons');
  const liveChannels = scope.querySelector('button[data-live-channel]')?.parentElement;
  if(fixedChannels) channelOptions.append(fixedChannels);
  if(liveChannels) channelOptions.append(liveChannels);
  channelOptions.append(...scope.querySelectorAll('button[id^="w"]'));
  const channelsButton = button('通道选择', () => { channelOptions.hidden=!channelOptions.hidden; sync(); });
  channelsButton.setAttribute('aria-expanded','false');

  const triggerOptions = document.createElement('div');
  triggerOptions.className = 'common-scope-options-inner';
  triggerOptions.hidden = true;
  const liveArm = byId('arm1163');
  if (liveArm) {
    for (const id of ['acquisition1163','triggerSource1163','triggerLevel1163','triggerSpan1163','triggerEdge1163','arm1163','triggerInfo1163']) {
      const node=byId(id);
      if (node) triggerOptions.append(node.closest('label') || node);
    }
  } else {
    triggerOptions.append(edgeBox);
  }
  const triggerButton = button('沿触发', () => {
    triggerOptions.hidden = !triggerOptions.hidden;
    edgeEnabled = !triggerOptions.hidden;
    if (!edgeEnabled) {
      edgeMark=null;
      byId('commonEdgeStatus').textContent='';
      if (liveArm && byId('acquisition1163')?.value === 'single') {
        const mode=byId('acquisition1163');
        mode.value='auto';
        mode.dispatchEvent(new Event('change'));
      }
    }
    refreshEdge();
    sync();
  });

  const cursorOptions = document.createElement('div');
  cursorOptions.className = 'common-scope-options-inner';
  cursorOptions.append(cursorControls);
  bar.append(cursorToggle);
  cursorToggle.addEventListener('click',sync);
  const comparison=byId('compareToggle');
  comparison.title='显示上一次波形，虚线表示上一次结果';
  const syncComparison=()=>{
    comparison.textContent='波形对比';
    comparison.setAttribute('aria-pressed',String(overlayEnabled));
  };
  comparison.addEventListener('click',syncComparison);
  syncComparison();
  for (const id of ['compareToggle','compareClear','lockBaseline','coldStart1163','play1163','advance1163','processInfo1163']) {
    const node=byId(id);
    if(node) bar.append(node);
  }
  bar.append(range);
  forwardCursorSummary=document.createElement('output');
  forwardCursorSummary.className='common-scope-summary';
  forwardCursorSummary.hidden=true;
  bar.append(forwardCursorSummary);
  band.append(channelOptions,triggerOptions,cursorOptions);
  tools.style.display='none';
  if (fullSource) fullSource.hidden=true;
  if (steadySource && steadySource!==byId('resetAxes')) steadySource.hidden=true;
  edgeEnabled=false;
  refreshEdge();

  function sync() {
    pan.setAttribute('aria-pressed', String(navigation.value==='pan'));
    zoom.setAttribute('aria-pressed', String(navigation.value==='zoom'));
    guide.setAttribute('aria-pressed', String(!scope.classList.contains('hide-forward-guide')));
    triggerButton.setAttribute('aria-expanded',String(!triggerOptions.hidden));
    channelsButton.setAttribute('aria-expanded',String(!channelOptions.hidden));
    cursorToggle.setAttribute('aria-expanded',String(cursorEnabled));
    band.hidden=channelOptions.hidden && triggerOptions.hidden && !cursorEnabled;
    const view=axes();
    const micro=view?.span < .002;
    const scale=micro?1e6:1000, unit=micro?'µs':'ms';
    const display=x=>Number((x*scale).toPrecision(6));
    range.textContent=view?.groups.length
      ? display(view.start)+' – '+display(view.start+view.span)+' '+unit+' · '+display(view.span/10)+' '+unit+'/格'
      : '等待波形';
  }

  const metrics = scope.closest('article')?.querySelector('.stats');
  if (metrics) {
    const offset = () => {
      const style=getComputedStyle(metrics);
      const top=style.position==='sticky'?metrics.getBoundingClientRect().height+(parseFloat(style.top)||0):0;
      scope.style.setProperty('--common-scope-top',top+'px');
    };
    new ResizeObserver(offset).observe(metrics);
    window.addEventListener('resize',offset);
    offset();
  }
  new ResizeObserver(() => scope.style.setProperty('--common-scope-bar-height',bar.getBoundingClientRect().height+'px')).observe(bar);
  navigation.addEventListener('change',sync);
  const before=update;
  update=function(){before();sync()};
  sync();
  update();
}
if (!forwardCursor) {
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',installLegacyScopeInterface,{once:true});
  else installLegacyScopeInterface();
}

})();

// Keep original metric nodes; compact them only after scrolling to the workbench.
(function compactLiveMetrics(){
 const metrics=document.querySelector('.layout>article>.stats');if(!metrics||metrics.childElementCount!==6)return;
 const marker=document.createElement('div');marker.className='metrics-marker';metrics.before(marker);
 const fit=()=>metrics.classList.toggle('metrics-docked',marker.getBoundingClientRect().top<12);
 let pending=false;const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;fit()})};
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});fit();
})();

// Developer edition: reflect schematic parameters without changing editing tools.
(function(){const prior=editorChanged;editorChanged=function(){prior();try{const pfc=typeof CHIP_STORAGE_PREFIX==='string'&&/^(eg1654|eg12523)/.test(CHIP_STORAGE_PREFIX),q=pfc?pfcExtract():extractCircuit(),forward=typeof CHIP_STORAGE_PREFIX==='string'&&/^eg12523/.test(CHIP_STORAGE_PREFIX),data=forward?{vin:q.vac,load:q.load,ind:q.L*1e6,cap:q.C*1e6,rs:(q.senseR||0)*1000,rcs:4300000/q.fs,rt:(circuit.parts.find(p=>p.id==='R22')?.value||0)/1000,rb:(circuit.parts.find(p=>p.id==='R34')?.value||0)/1000}:pfc?{vin:q.vac,load:q.power,ind:q.L*1e6,cap:q.C*1e6/2,rs:q.rs*1000,rcs:q.rcs/1000}:Object.fromEntries(['vin','load','ind','cap','rt','rb','rs'].map(k=>[k,q[k]]));if(pfc&&!forward){data.rt=['R9','R12','R15'].reduce((a,id)=>a+(circuit.parts.find(p=>p.id===id)?.value||0),0)/1000;data.rb=circuit.parts.find(p=>p.id==='R18')?.value/1000}for(let [id,v]of Object.entries(data)){let n=document.getElementById(id);if(!n||document.activeElement===n||!Number.isFinite(v))continue;if(n.type==='range'){if(v>Number(n.max)&&!(forward&&id==='load'))n.max=v;if(v<Number(n.min))n.min=v}n.value=v}if(typeof eg1163RoleParts==='function'){let lab=document.getElementById('cap')?.previousElementSibling,node=lab&&[...lab.childNodes].find(n=>n.nodeType===3);if(node)node.textContent='输出电容 '+[...new Set(eg1163RoleParts('C7').map(p=>p.refdes||p.id))].join('、')+' / µF '}}catch{}}})();

const BUCK_MAG_CORES=[["930", 75, 63.5, 65.4, 4150, 27.69, 14.1, 11.94, 60], ["930", 113, 63.5, 65.4, 4150, 27.69, 14.1, 11.94, 90], ["930", 157, 63.5, 65.4, 4150, 27.69, 14.1, 11.94, 125], ["426", 69, 66.5, 72.7, 4840, 30, 17.4, 10.9, 60], ["426", 104, 66.5, 72.7, 4840, 30, 17.4, 10.9, 90], ["426", 144, 66.5, 72.7, 4840, 30, 17.4, 10.9, 125], ["548", 61, 81.4, 65.6, 5340, 33.66, 19.46, 11.43, 60], ["548", 91, 81.4, 65.6, 5340, 33.66, 19.46, 11.43, 90], ["548", 127, 81.4, 65.6, 5340, 33.66, 19.46, 11.43, 125], ["324", 56, 89.8, 67.8, 6090, 36.7, 21.54, 11.35, 60], ["324", 84, 89.8, 67.8, 6090, 36.7, 21.54, 11.35, 90], ["324", 117, 89.8, 67.8, 6090, 36.7, 21.54, 11.35, 125], ["395", 122, 95.1, 153.7, 14600, 40.94, 21.27, 17.89, 60], ["395", 183, 95.1, 153.7, 14600, 40.94, 21.27, 17.89, 90], ["395", 254, 95.1, 153.7, 14600, 40.94, 21.27, 17.89, 125], ["454", 108, 102, 147.5, 15100, 43.84, 23.39, 17.27, 60], ["454", 161, 102, 147.5, 15100, 43.84, 23.39, 17.27, 90], ["454", 224, 102, 147.5, 15100, 43.84, 23.39, 17.27, 125], ["438", 135, 107.4, 199, 21400, 47.63, 23.32, 18.92, 60], ["438", 202, 107.4, 199, 21400, 47.63, 23.32, 18.92, 90], ["438", 281, 107.4, 199, 21400, 47.63, 23.32, 18.92, 125], ["725", 175, 114, 262, 29700, 51.51, 24, 21.59, 60], ["725", 269, 114, 262, 29700, 51.51, 24, 21.59, 90], ["725", 366, 114, 262, 29700, 51.51, 24, 21.59, 125], ["715", 73, 127.3, 125.1, 15900, 51.69, 30.94, 14.35, 60], ["715", 109, 127.3, 125.1, 15900, 51.69, 30.94, 14.35, 90], ["715", 152, 127.3, 125.1, 15900, 51.69, 30.94, 14.35, 125], ["620", 189, 144, 360.2, 51900, 63.09, 31.7, 25.91, 60], ["620", 284, 144, 360.2, 51900, 63.09, 31.7, 25.91, 90], ["620", 394, 144, 360.2, 51900, 63.09, 31.7, 25.91, 125], ["778", 205, 177.2, 492, 81500, 78.94, 38.33, 26.85, 60], ["778", 306, 177.2, 492, 81500, 78.94, 38.33, 26.85, 90], ["778", 425, 177.2, 492, 81500, 78.94, 38.33, 26.85, 125]];
function buckToroidPlan(core,q,count,j,d,nOverride=0){if(!(Number.isInteger(count)&&count>0&&j>0&&d>0))throw Error('叠环数量需正整数，电流密度和线径需正数');let [size,al,le,ae,ve,od,id,ht,mu=60]=core,coeff={60:[2.142e-6,1.855],90:[5.830e-6,1.819],125:[2.209e-5,1.636]}[mu],bias=n=>Math.min(1,1/(.01+coeff[0]*(1.256637*n*q.maxPeak/(le/10))**coeff[1])/100),n=Math.ceil(Math.sqrt(q.l/(al*count*1e-9)));if(nOverride>0)n=nOverride;let zero=al*count*1e-9*n*n,retain=bias(n),loaded=zero*retain,checkPeak=q.maxPeak,checkRipple=q.maxRipple,converged=false;for(let k=0;k<100;k++){let factor=Math.min(1,1/(.01+coeff[0]*(1.256637*n*checkPeak/(le/10))**coeff[1])/100);loaded=zero*factor;checkRipple=q.maxRipple*q.l/loaded;let next=(q.ip??q.maxPeak)+checkRipple/2;if(!Number.isFinite(next)||next>1000)break;if(Math.abs(next-checkPeak)<1e-5){checkPeak=next;converged=true;break}checkPeak=next}retain=loaded/zero;let checkRms=Math.sqrt((q.irms??q.rms)**2+checkRipple**2/12),areaNeed=checkRms/j,strands=Math.max(1,Math.ceil(areaNeed/(Math.PI*d*d/4))),area=strands*Math.PI*d*d/4,fill=n*area/(Math.PI*id*id/4),mlt=2*((od-id)/2+ht*count)*(1+fill),rdc=.017241*n*mlt/1000/area,skin=Math.sqrt(1.7241e-8/(Math.PI*65000*4e-7*Math.PI))*1000;return {size,n,zero,checkPeak,checkRipple,checkRms,converged,retain,loaded,strands,area,fill,mlt,rdc,skin,count,d,ae,ve,le,valid:n<3000&&zero>=q.l&&converged&&fill<=.45}}
function buckInductorDesign(s){let {vinMin,vinMax,vout,load,fs,ripple}=s;if(!(vinMin>vout&&vinMax>=vinMin&&vout>0&&load>0&&fs>0&&ripple>0))throw Error('需满足输入最低值>输出电压，最高≥最低，其余参数为正数');let delta=load*ripple,l=vout*(1-vout/vinMax)/(fs*delta);return {l,delta,maxRipple:delta,ip:load,irms:load,maxPeak:load+delta/2,peak:load+delta/2,rms:Math.sqrt(load*load+delta*delta/12)}}
(function(){if(typeof CHIP_STORAGE_PREFIX==='string'&&/^(eg1654|eg12523)/.test(CHIP_STORAGE_PREFIX))return;const $=id=>document.getElementById(id),layout=document.querySelector('.layout');if(!layout)return;const sync=typeof eg1163Oscillator==='function',box=document.createElement('section'),nav=document.createElement('div');nav.style.cssText='display:flex;gap:8px;margin:14px 0';box.className='panel';box.style.cssText='padding:18px';box.hidden=true;box.id='buckMagDesign';nav.innerHTML='<button type="button">电路与仿真</button><button type="button">电感设计</button>';layout.before(nav);layout.after(box);let css=document.createElement('style');css.textContent='.layout[hidden],#buckMagDesign[hidden]{display:none!important}.buck-mag-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0}.buck-mag-grid label{display:grid;gap:6px}.buck-mag-grid input,.buck-mag-grid select{width:100%;box-sizing:border-box;padding:8px}.buck-mag-card{background:#eef5fb;border:1px solid #d4e3ef;border-radius:8px;padding:12px}.buck-mag-card strong{display:block;font-size:22px;color:#327ab4;margin-top:8px}@media(max-width:750px){.buck-mag-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.append(css);box.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px"><h2>设计条件 · '+(sync?'同步降压':'异步降压')+'</h2><button id="buckMagApply">应用计算电感量</button></div><div id="buckMagInputs" class="buck-mag-grid"></div><button id="buckMagRead">重新读取电路</button><h2 style="margin-top:18px">计算结果</h2><div id="buckMagResults" class="buck-mag-grid"></div><h2>磁芯与绕组 · 铁硅铝磁环</h2><div class="buck-mag-grid"><label>叠环数量<input id="buckMagCount" type="number" value="1" min="1" step="1"></label><label>电流密度 / A·mm⁻²<input id="buckMagJ" type="number" value="6" min="0" step="any"></label><label>单股铜线直径 / mm<input id="buckMagWire" type="number" value="0.1" min="0" step="any"></label><label>磁环规格<select id="buckMagCore"></select></label></div><button id="buckMagRecommend">推荐磁环</button><div id="buckMagPlan" class="buck-mag-grid"></div><p id="buckMagStatus"></p><details><summary>计算口径</summary><p>Buck CCM理想公式：L=Vout(1−Vout/Vin,max)/(fs·ΔI)，ΔI=r·Iout。以零电流感量作为绕制目标；偏置后的纹波和峰值另做保守校核。未计二极管、MOS与电感压降；轻载DCM/同步负电流限制需结合仿真复核。偏置保留率=L(Ipk)/L0；窗口铜占比还未包含漆膜、绝缘与穿线空间。</p><a href="https://www.mag-inc.com/products/powder-cores/kool-mu-cores" target="_blank" rel="noopener">美磁磁环数据</a></details>';let fields={},dirty=false,current=null,specs=[['vinMin','输入最低 / V'],['vinMax','输入最高 / V'],['vout','目标输出 / V'],['load','输出电流 / A'],['fs','开关频率 / kHz'],['ripple','目标纹波 / %']];for(let [key,label]of specs){let row=document.createElement('label'),n=document.createElement('input');row.textContent=label;n.type='number';n.step='any';n.min='0';row.append(n);$('buckMagInputs').append(row);fields[key]=n;n.oninput=()=>{dirty=true;render()}}BUCK_MAG_CORES.forEach((c,i)=>$('buckMagCore').add(new Option('铁硅铝 '+c[8]+'µ · 尺寸'+c[0]+' · '+c[5]+'mm',i)));let card=(a,b)=>'<div class="buck-mag-card"><small>'+a+'</small><strong>'+b+'</strong></div>';function render(recommend=false){try{let data=Object.fromEntries(specs.map(([k])=>[k,Number(fields[k].value)]));data.fs*=1000;data.ripple/=100;let q=buckInductorDesign(data);current=q;$('buckMagResults').innerHTML=card('计算所需感量',engineeringValue('L',q.l*1e6).text)+card('最大峰值',q.maxPeak.toFixed(3)+' A')+card('纹波峰峰值',q.delta.toFixed(3)+' App')+card('电感有效值',q.rms.toFixed(3)+' A');if(!sync){$('buckMagResults').innerHTML=card('建议电感量',engineeringValue('L',q.l*1e6).text)+card('所需饱和电流', '≥'+(200/extractCircuit().rs).toFixed(2)+' A');$('buckMagPlan').textContent='推荐一体成型贴片功率电感；Isat按厂家电感下降定义及温度选取，额定温升电流也须满足负载。尺寸待具体料号确认。';$('buckMagStatus').textContent='';return}let count=Number($('buckMagCount').value),j=Number($('buckMagJ').value),d=.1,bundles=Number($('buckMagWire').value);if(!(Number.isInteger(bundles)&&bundles>0))throw Error('铜线股数需为正整数');if(recommend){let found=BUCK_MAG_CORES.findIndex(c=>{let p=buckToroidPlan(c,q,count,j,d);return p.valid&&p.fill/.6<=.45});if(found<0)throw Error('当前规格绕线空间或感量不满足，请增加叠环或换更大磁环');$('buckMagCore').value=found}let p=buckToroidPlan(BUCK_MAG_CORES[Number($('buckMagCore').value)],q,count,j,d);let core=BUCK_MAG_CORES[Number($('buckMagCore').value)],mu=core[8],cf={60:[2.142e-6,1.855],90:[5.830e-6,1.819],125:[2.209e-5,1.636]}[mu],h30=Math.pow((1/70-.01)/cf[0],1/cf[1]),isat30=h30*(core[2]/10)/(1.256637*p.n),copperDiameter=Math.sqrt(4*p.area/(Math.PI*bundles)),bundleDiameter=copperDiameter/Math.sqrt(.6),actualFill=p.fill/.6;$('buckMagPlan').innerHTML=card('每股利兹线等效铜径',copperDiameter.toFixed(1)+' mm × '+bundles+' 股')+card('绕组匝数',p.n+' 匝')+card('零电流感量L0',engineeringValue('L',p.zero*1e6).text)+card('峰值电流下感量',engineeringValue('L',p.loaded*1e6).text)+card('饱和电流 Isat30%',isat30.toFixed(1)+' A');$('buckMagStatus').textContent=(actualFill>.45?'绕线困难：估算含绝缘束径约'+bundleDiameter.toFixed(1)+'mm，窗口空间不足，请换更大磁环或增加叠环。':'并绕利兹线；等效铜径不是成品外径，需按供应商束径复核绕线。')+' Isat30%指电感降至L0的70%，不是磁粉芯突然饱和点。束径检查采用60%铜填充的设计假设；厂家实际束径优先。'+(isat30<180/extractCircuit().rs?' 警告：电路峰值限流 '+(180/extractCircuit().rs).toFixed(1)+' A（0.18V/R）超过磁环Isat30%，请换型或调整限流电阻。':'')}catch(e){current=null;$('buckMagResults').textContent=e.message;$('buckMagPlan').textContent='';$('buckMagStatus').textContent=''}}function read(){try{let s=extractCircuit(),v=s.vin,target=sync?1.2*(1+s.rt/s.rb):1.3*(1+s.rt/s.rb),f=sync?eg1163Oscillator(s.cp).frequency:chipBehavior.spec.fosc;let values={vinMin:sync?30:20,vinMax:sync?90:150,vout:12,load:sync?10:2,fs:f/1000,ripple:30};for(let [k,v]of Object.entries(values))fields[k].value=Number(v.toPrecision(8));dirty=false;render(true)}catch(e){$('buckMagStatus').textContent=e.message}}$('buckMagRead').onclick=read;$('buckMagRecommend').onclick=()=>render(true);for(let id of ['buckMagCount','buckMagJ','buckMagWire','buckMagCore'])$(id).onchange=()=>render();$('buckMagApply').onclick=()=>{render();if(!current)return;let n=$('ind'),v=current.l*1e6;n.max=Math.max(Number(n.max),v);n.min=Math.min(Number(n.min),v);n.value=v;syncSliders('ind');editorChanged()};nav.children[0].onclick=()=>{box.hidden=true;layout.hidden=false};nav.children[1].onclick=()=>{box.hidden=false;layout.hidden=true;if(!dirty)read();else render()};if(!sync){for(let id of ['buckMagCount','buckMagJ','buckMagWire','buckMagCore'])$(id).parentElement.hidden=true;$('buckMagRecommend').hidden=true;let h=[...box.querySelectorAll('h2')].find(n=>n.textContent.includes('磁芯与绕组'));if(h)h.style.display='none';for(let n of [$('buckMagCount').parentElement.parentElement,$('buckMagRecommend'),$('buckMagPlan'),$('buckMagStatus')])n.style.setProperty('display','none','important');let compact=document.createElement('style');compact.textContent='#buckMagInputs{grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}#buckMagInputs input{min-width:0;padding:7px}@media(max-width:850px){#buckMagInputs{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:480px){#buckMagInputs{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.append(compact)}else{let wire=$('buckMagWire'),label=wire.parentElement;label.childNodes[0].textContent='铜线股数';wire.value=1;wire.min=1;wire.step=1;let recommend=$('buckMagRecommend');recommend.textContent='（推荐磁环）';recommend.style.cssText='padding:5px 8px;white-space:nowrap';let holder=document.createElement('div');holder.style.cssText='display:flex;gap:5px;align-items:center';let model=$('buckMagCore');model.before(holder);holder.append(model);let title=document.createElement('span'),coreLabel=model.closest('label');title.style.cssText='display:flex;align-items:center;gap:5px;flex-wrap:wrap';if(coreLabel.firstChild?.nodeType===3)coreLabel.firstChild.remove();title.append(document.createTextNode('磁环规格'),recommend);coreLabel.prepend(title);let compact=document.createElement('style');compact.textContent='#buckMagInputs{grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}#buckMagInputs input{min-width:0;padding:7px}@media(max-width:850px){#buckMagInputs{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:480px){#buckMagInputs{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.append(compact);}read()})();
