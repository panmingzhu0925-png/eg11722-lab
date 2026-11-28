import {calculate} from './transformer-math.mjs?v=table-20261128';
export {calculate};
if(typeof document!=='undefined')setup().catch(error=>{const status=document.querySelector('#status');status.hidden=false;status.textContent='计算数据加载失败，请刷新重试。';console.error(error)});
async function setup(){
 const response=await fetch('./eg12523-transformer-data.json?v=table-20261128');if(!response.ok)throw Error('Workbook data unavailable');
 const {rows,cores}=await response.json(),inputs=new Map(),fractions=new Set([13,15,16,27]);
 const labels={6:'交流输入下限',7:'交流输入上限',10:'输出电压',11:'输出电流',12:'开关频率',13:'预计效率',14:'输出二极管压降',15:'电感电流纹波比',16:'最大占空比上限',18:'设计磁通密度上限 B',20:'有效截面积 Ae',22:'原边匝数 Np',24:'次级匝数 Ns',30:'绕组电流密度',32:'单股线径',35:'单股线径',37:'单股线径',40:'电感绕组电流密度'};
 const units={6:'Vac',7:'Vac',12:'kHz',13:'%',15:'%',16:'%',18:'mT',20:'mm²',22:'匝',24:'匝',30:'A/mm²',32:'mm',35:'mm',37:'mm'};
 const multiplier=r=>fractions.has(r)?100:1;
 const format=(value,digits=3)=>Number.isFinite(value)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:digits}).format(value):'—';
 let selectedCore=null,requiredAP=NaN,coreNotice='',modelChoices='';const usableCores=cores.filter(core=>core[1]);
 function cellNumber(cell){const text=cell.textContent.trim();return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)?Number(text):NaN}
 function add(target,ids){for(const id of ids){
  const cell=document.querySelector('#input-'+id);cell.contentEditable='plaintext-only';cell.tabIndex=0;cell.spellcheck=false;cell.setAttribute('role','textbox');cell.setAttribute('aria-label',labels[id]);cell.setAttribute('inputmode',[22,24].includes(id)?'numeric':'decimal');
  cell.onfocus=()=>cell.dataset.beforeEdit=cell.textContent;
  cell.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();cell.blur()}if(event.key==='Escape'){event.preventDefault();cell.textContent=cell.dataset.beforeEdit;cell.dispatchEvent(new Event('input',{bubbles:true}));cell.blur()}};
  cell.oninput=()=>{if(id===20){selectedCore=null;coreNotice='';showCore()}recalculate()};inputs.set(id,cell);
 }}
 add('#conditions',[6,7,10,11,12,13,14,15,16]);add('#core-limit',[18]);add('#core-area',[20]);add('#windings',[22,24]);add('#wire-density',[30]);add('#primary-field',[32]);add('#secondary-field',[35]);add('#inductor-field',[37,40]);
 const recommendations=new Map();
 for(const row of [22,24]){
  const hint=document.createElement('div');hint.className='turn-recommendation';
  const theory=document.createElement('small'),button=document.createElement('button');
  button.type='button';button.dataset.recommendTurns=row;
  button.onclick=()=>{if(button.disabled)return;inputs.get(row).textContent=button.dataset.turns;inputs.get(row).dispatchEvent(new Event('input',{bubbles:true}))};
  hint.append(button);document.querySelector('#theory-'+row).append(hint);recommendations.set(row,{theory,button});
 }

 for(const row of rows){const tr=document.createElement('tr');for(const [i,value] of ['C'+row.row,row.label,'',fractions.has(row.row)?'%':row.unit==='T'?'匝':row.unit,row.row===38?'Io / [电感电流密度 × (3.14 × 线径² / 4)]，原表电流密度为 6 A/mm²':row.formula?'='+row.formula+(row.note?' ； '+row.note:''):row.note].entries()){const td=document.createElement('td');td.textContent=value??'';if(i===2){td.id='detail-'+row.row;td.className='value'}if(i===4&&row.formula)td.className='formula';tr.append(td)}document.querySelector('#design-rows').append(tr)}
 function recalculate(){
  const data=Object.fromEntries([...inputs].map(([row,input])=>{const value=cellNumber(input),valid=Number.isFinite(value)&&(value>0||(row===14&&value===0))&&(![22,24].includes(row)||Number.isSafeInteger(value))&&(![13,16].includes(row)||value<=100);input.setAttribute('aria-invalid',String(!valid));return[row,valid?value/multiplier(row):NaN]}));const result=calculate({...data,inductorCurrentDensity:data[40]});
  for(const [row,sourceRow] of [[22,21],[24,23]]){
   const {theory,button}=recommendations.get(row),value=result[sourceRow],turns=Math.ceil(value);
   const valid=Number.isSafeInteger(turns)&&turns>0&&data[6]<=data[7];
   theory.textContent='理论 '+format(value)+' 匝';button.disabled=!valid;button.dataset.turns=valid?String(turns):'';
   button.textContent=valid?'推荐 '+turns+' 匝 · 采用':'推荐值待计算';
   button.setAttribute('aria-label',(row===22?'原边':'次级')+(valid?'采用推荐 '+turns+' 匝':'推荐值待计算'));
  }

  document.querySelectorAll('[data-r]').forEach(output=>{const row=Number(output.dataset.r);output.value=format(result[row]*(output.hasAttribute('data-flux-limit')?1000:fractions.has(row)?100:1))});
  document.querySelector('#power').value=format(data[10]*data[11],1);
  for(const [key,diameter,strands]of [['primary',32,33],['secondary',35,36],['inductor',37,38]])document.querySelector('#'+key+'-wire').textContent=Number.isFinite(result[strands])&&result[strands]>0?format(data[diameter])+' mm × '+Math.ceil(result[strands])+' 股':'—';
  document.querySelector('#diode-rating').value=format(result[39]*1.5,2);
  requiredAP=result[19];updateCoreAP();
  document.querySelector('#core-dimensions').textContent=selectedCore?'AP '+format(selectedCore[3])+' cm⁴ / Aw '+format(selectedCore[5])+' mm²':'选择磁芯后显示 AP、Aw。';

  const errors=[];if(Object.values(data).some(Number.isNaN))errors.push('请填写有效的正数，二极管压降可为 0，匝数需为整数。');if(data[6]>data[7])errors.push('交流输入下限不能高于上限。');if(data[16]>=.5)errors.push('双管正激的最大占空比需低于 50%，原表建议低于 46%。');else if(data[16]>.46)errors.push('占空比上限超过原表建议的 46%。');if(result[26]<=0)errors.push('当前匝比无法得到正的输出电感量，请检查输入与匝数。');const status=document.querySelector('#status');status.hidden=!errors.length;status.textContent=errors.join(' ');
  const ratioWarning=document.querySelector('#ratio-warning'),ratioTooHigh=Number.isFinite(result[25])&&Number.isFinite(result[17])&&result[25]>result[17];
  ratioWarning.textContent=ratioTooHigh?'实际匝比超过理论值，请减小原边匝数或增加次级匝数。':'';ratioWarning.className=ratioTooHigh?'shortfall':'';
  for(const row of rows)document.querySelector('#detail-'+row.row).textContent=format(result[row.row]*(fractions.has(row.row)?100:1),6);
 }
 function showCore(){document.querySelector('#core-model').value=selectedCore?String(usableCores.indexOf(selectedCore)):'';document.querySelector('#core-selection').textContent=selectedCore?'已选 '+selectedCore[0].trim()+' / '+selectedCore[1]+'，Ae '+format(selectedCore[4])+' mm²':'自定义 Ae，默认值取自原表。';document.querySelectorAll('#core-rows tr').forEach(tr=>tr.classList.toggle('selected',tr.dataset.name===selectedCore?.[0]))}
 function reset(){for(const row of rows){const input=inputs.get(row.row);if(input)input.textContent=row.row===30?6:Number((row.initial*multiplier(row.row)).toPrecision(12))}inputs.get(40).textContent=6;selectedCore=null;coreNotice='';showCore();recalculate()}document.querySelector('#reset').onclick=reset;
 const model=document.querySelector('#core-model');
 model.onchange=()=>{coreNotice='';selectedCore=model.value===''?null:usableCores[Number(model.value)];if(selectedCore)inputs.get(20).textContent=selectedCore[4];showCore();recalculate()};
 const catalog=[];let section='';for(const core of cores){if(!core[1]){section=core[0];continue}const tr=document.createElement('tr');tr.dataset.name=core[0];for(const i of [0,1,4,5,3,6]){const td=document.createElement('td');td.textContent=typeof core[i]==='number'?format(core[i]):core[i]?.trim()??'—';tr.append(td)}const comparison=document.createElement('td');comparison.className='ap-comparison';tr.append(comparison);const td=document.createElement('td'),button=document.createElement('button');button.textContent='填入 Ae';button.setAttribute('aria-label','填入 '+core[0].trim()+' 的 Ae');button.disabled=!(Number(core[4])>0);button.onclick=()=>{inputs.get(20).textContent=core[4];coreNotice='';selectedCore=core;showCore();recalculate();inputs.get(20).focus()};td.append(button);tr.append(td);document.querySelector('#core-rows').append(tr);catalog.push({tr,comparison,ap:typeof core[3]==='number'&&core[3]>0?core[3]:NaN,text:[section,...core].join(' ').toLowerCase()})}
 function filter(){const query=document.querySelector('#core-search').value.trim().toLowerCase();let count=0;for(const {tr,text,ap}of catalog){tr.hidden=!text.includes(query)||(document.querySelector('#ap-only').checked&&!(Number.isFinite(requiredAP)&&ap>=requiredAP));if(!tr.hidden)count++}document.querySelector('#core-count').textContent=count+' / '+catalog.length+' 种磁芯';document.querySelector('#core-empty').hidden=count>0}document.querySelector('#core-search').oninput=filter;

 function updateCoreAP(){
  const valid=Number.isFinite(requiredAP)&&requiredAP>0;
  const eligible=usableCores.map((core,index)=>({core,index})).filter(({core})=>valid&&typeof core[3]==='number'&&core[3]>=requiredAP&&Number(core[4])>0);
  if(valid&&selectedCore&&!eligible.some(({core})=>core===selectedCore)){coreNotice='原选型号 AP 不足，已切换手动 Ae，数值保留。';selectedCore=null;showCore()}
  const choiceKey=eligible.map(({index})=>index).join(',');
  if(choiceKey!==modelChoices||!model.querySelector('option[value=""]')){
   modelChoices=choiceKey;model.replaceChildren();const manual=document.createElement('option');manual.value='';manual.textContent='手动填写 Ae';model.append(manual);
   for(const {core,index} of eligible){const option=document.createElement('option');option.value=String(index);option.textContent=core[0].trim()+' / '+core[1];model.append(option)}
  }
  model.value=selectedCore?String(usableCores.indexOf(selectedCore)):'';
  for(const item of catalog){const known=Number.isFinite(item.ap);item.tr.querySelector('button').disabled=!(valid&&known&&item.ap>=requiredAP);item.comparison.textContent=!valid?'待计算':!known?'缺少 AP':item.ap>=requiredAP?'AP 满足':'AP 不足';item.comparison.className='ap-comparison '+(!valid||!known?'unknown':item.ap>=requiredAP?'meets':'shortfall')}
  const text=document.querySelector('#selected-ap');text.className='';
  if(!selectedCore){text.textContent=coreNotice||'按 AP 筛选后核对 Ae。';if(coreNotice)text.className='shortfall'}
  else if(!valid)text.textContent='请完善输入参数后对比磁芯 AP。';
  else{const ap=selectedCore[3],known=typeof ap==='number'&&ap>0;text.textContent=!known?'所选磁芯缺少 AP 数据。':'所选 AP '+format(ap)+' cm⁴'+(ap>=requiredAP?'，满足面积积要求。':'，低于理论所需值。');text.className=known&&ap<requiredAP?'shortfall':''}
  filter();
 }
 document.querySelector('#ap-only').onchange=filter;
 document.querySelector('#catalog-link').onclick=()=>{document.querySelector('#core-catalog').open=true};
 document.querySelector('#choose-core').onclick=()=>{document.querySelector('#core-catalog').open=true;setTimeout(()=>document.querySelector('#core-search').focus(),0)};reset();filter();
}
