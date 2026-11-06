import './style.css';
import {registerSW} from 'virtual:pwa-register';
import * as ai from './ai.js';
import {importFile,exportPDF,exportPPTX,exportDOC,exportTXT,kv} from './docs.js';
import {mountPhoto} from './photo.js';
import {mountGrades} from './grades.js';

registerSW({immediate:true});

const $=s=>document.querySelector(s),all=s=>document.querySelectorAll(s),st=t=>$('#st').textContent=t;

all('nav button').forEach(b=>b.onclick=()=>{
  all('nav button').forEach(x=>x.classList.toggle('on',x===b));
  all('main section').forEach(s=>s.hidden=s.id!==b.dataset.t);
});

/* ---------------- AI ---------------- */
// DeepSeek-R1 distills wrap scratch work in  thinking… /  thinking…; keep it out of the answer.
const clean=t=>{
  let s=String(t).replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi,'');
  s=s.replace(/^[\s\S]*<\/think(?:ing)?>/i,'');          // sometimes only the closing tag is emitted
  s=s.replace(/<think(?:ing)?>[\s\S]*$/i,'(thinking…)'); // still streaming its thoughts
  return s.trim();
};

async function run(messages,el){
  if(!ai.ready()){el.textContent='Load the AI first (top bar).';return ''}
  let t='';el.textContent='';st('Thinking…');
  try{for await(const c of ai.stream(messages)){t+=c;el.textContent=clean(t)}}
  catch(e){el.textContent='AI error: '+(e?.message||e)}
  st('');
  return clean(t);
}

(async()=>{
  let list=null;
  try{list=await ai.models()}catch(e){console.warn('GPU probe failed:',e)}
  if(!list){
    st('No WebGPU in this browser: the AI is off, everything else works.');
    $('#load').disabled=true;$('#model').innerHTML='<option>AI not available</option>';return;
  }
  if(!list.length){
    st('No compatible small model found — update the app or try another browser.');
    $('#load').disabled=true;$('#model').innerHTML='<option>No compatible model</option>';return;
  }
  list.forEach(m=>$('#model').add(new Option(
    `${m.model_id.replace('-MLC','')} · ${((m.vram_required_MB||0)/1024).toFixed(1)} GB`,m.model_id)));
  const saved=await kv.get('model');
  $('#model').value=list.some(m=>m.model_id===saved)?saved:(list.find(m=>/deepseek/i.test(m.model_id))||list[0]).model_id;
})();

$('#load').onclick=async()=>{
  const id=$('#model').value;if(!id)return;
  $('#load').disabled=true;$('#unload').hidden=true;$('#prog').hidden=false;$('#prog').value=0;
  try{
    await ai.load(id,p=>{
      $('#prog').value=p.progress||0;
      st(`${Math.round((p.progress||0)*100)}% ${(p.text||'').slice(0,60)}`);
    });
    await kv.set('model',id);
    st('AI ready — it now runs fully offline');
    $('#unload').hidden=false;
  }catch(e){
    st('Load failed: '+(e?.message||e)+'. Try the smallest model and close other tabs.');
  }
  $('#prog').hidden=true;$('#load').disabled=false;
};

$('#unload').onclick=async()=>{
  $('#unload').disabled=true;
  await ai.unload();
  $('#unload').hidden=true;$('#unload').disabled=false;
  st('AI unloaded — memory freed');
};

$('#stop').onclick=ai.stop;

/* ---------------- Documents ---------------- */
const ed=$('#ed');let tm,last='';
kv.get('doc').then(v=>{if(typeof v==='string')ed.value=v});
ed.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>kv.set('doc',ed.value),400)};

const imp=(input,set)=>input.onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  st('Reading '+f.name+'…');
  try{set(await importFile(f));st('')}
  catch(x){st('Could not read '+f.name+': '+(x?.message||x))}
  e.target.value='';
};
imp($('#imp'),t=>{ed.value=t;kv.set('doc',t)});
imp($('#mimp'),t=>{mp.value=t.slice(0,4000);saveMath()});

all('[data-x]').forEach(b=>b.onclick=async()=>{
  const fn={pdf:exportPDF,pptx:exportPPTX,doc:exportDOC,txt:exportTXT}[b.dataset.x];
  st('Exporting '+b.dataset.x.toUpperCase()+'…');
  try{await fn(ed.value,'homework');st('Exported')}
  catch(e){st('Export failed: '+(e?.message||e))}
});

$('#ask').onclick=async()=>{
  const sel=ed.value.slice(ed.selectionStart,ed.selectionEnd)||ed.value;
  last=await run([
    {role:'system',content:'You are a patient homework helper. Be concise, show key steps, use plain text.'},
    {role:'user',content:`Document:\n${sel.slice(0,2500)}\n\nQuestion: ${$('#q').value}`}
  ],$('#out'));
};
$('#q').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#ask').click()}});
$('#ins').onclick=()=>{
  if(!last)return;
  ed.setRangeText('\n'+last+'\n',ed.selectionEnd,ed.selectionEnd,'end');
  ed.dispatchEvent(new Event('input'));ed.focus();
};

/* ---------------- Math check ---------------- */
const mp=$('#mp'),mw=$('#mw'),mo=$('#mo');
let mlast='',mt;
const saveMath=()=>{clearTimeout(mt);mt=setTimeout(()=>{kv.set('mp',mp.value);kv.set('mw',mw.value)},400)};
Promise.all([kv.get('mp'),kv.get('mw')]).then(([p,w])=>{
  if(typeof p==='string')mp.value=p;
  if(typeof w==='string')mw.value=w;
});
mp.oninput=mw.oninput=saveMath;

const mrun=(sys,tail)=>run([
  {role:'system',content:sys},
  {role:'user',content:`Problem:\n${mp.value.slice(0,1200)}\n\nStudent work:\n${mw.value.slice(0,1200)}\n\n${tail}`}
],mo).then(t=>{mlast=t});

$('#grade').onclick=()=>mrun('You are a strict math teacher. Check every step. Do not show private reasoning. Reply with: VERDICT (CORRECT, PARTIAL or INCORRECT), the first wrong step if any, then the correct final answer. Be brief.','Grade this.');
$('#hint').onclick=()=>mrun('You are a math tutor. Give one hint only, never the final answer, and do not show private reasoning.','Give a hint.');
$('#solve').onclick=()=>mrun('You are a math tutor. Solve step by step, do not show private reasoning, and put the final answer on the last line.','Solve it.');
$('#mins').onclick=()=>{
  if(!mlast)return;
  mw.setRangeText('\n'+mlast+'\n',mw.selectionEnd,mw.selectionEnd,'end');
  mw.dispatchEvent(new Event('input'));mw.focus();
};

/* ---------------- Mount extras ---------------- */
mountPhoto($('#photo'));
mountGrades($('#grades')).catch(e=>console.error('grades:',e));
