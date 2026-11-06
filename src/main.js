import './style.css';
import {registerSW} from 'virtual:pwa-register';
import * as ai from './ai.js';
import {importFile,exportPDF,exportPPTX,exportDOC,exportTXT,kv} from './docs.js';
import {mountPhoto} from './photo.js';
import {mountGrades} from './grades.js';
import {mountChat} from './chat.js';

registerSW({immediate:true});

const $=s=>document.querySelector(s),all=s=>document.querySelectorAll(s),st=t=>$('#st').textContent=t;

// Navigation
all('nav button').forEach(b=>b.onclick=()=>{
  all('nav button').forEach(x=>x.classList.toggle('active',x===b));
  all('main section').forEach(s=>s.hidden=s.id!==b.dataset.t);
});

// Setup AI Models
(async()=>{
  let list=null;
  try{list=await ai.models()}catch(e){console.warn('GPU probe failed:',e)}
  if(!list){
    st('No WebGPU. AI features disabled.');$('#load').disabled=true;
    $('#model').innerHTML='<option>AI not available</option>';return;
  }
  if(!list.length){
    st('No models found.');$('#load').disabled=true;return;
  }
  
  // Group by warning size
  list.forEach(m=>{
    const size=(m.vram_required_MB||0)/1024;
    const warn=size>4?' (⚠️ Heavy)':'';
    $('#model').add(new Option(`${m.model_id.replace('-MLC','')} · ${size.toFixed(1)}GB${warn}`,m.model_id));
  });
  
  const saved=await kv.get('model');
  $('#model').value=list.some(m=>m.model_id===saved)?saved:(list.find(m=>/qwen2.5-1.5b/i.test(m.model_id))||list[0]).model_id;
})();

$('#load').onclick=async()=>{
  const id=$('#model').value;if(!id)return;
  $('#load').disabled=true;$('#unload').hidden=true;$('#prog-wrap').hidden=false;$('#prog').value=0;
  try{
    await ai.load(id,p=>{
      $('#prog').value=p.progress||0;
      st(`${Math.round((p.progress||0)*100)}% ${(p.text||'').slice(0,30)}...`);
    });
    await kv.set('model',id);
    st('AI Ready'); $('#unload').hidden=false;
  }catch(e){
    st('Load failed: '+(e?.message||e));
  }
  $('#prog-wrap').hidden=true;$('#load').disabled=false;
};

$('#unload').onclick=async()=>{
  $('#unload').disabled=true; await ai.unload();
  $('#unload').hidden=true;$('#unload').disabled=false; st('Unloaded');
};

// Documents
const ed=$('#ed');let tm,last='';
kv.get('doc').then(v=>{if(typeof v==='string')ed.value=v});
ed.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>kv.set('doc',ed.value),400)};

const imp=(input,set)=>input.onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  st('Reading '+f.name+'…');
  try{set(await importFile(f));st('')}
  catch(x){st('Error: '+(x?.message||x))}
  e.target.value='';
};
imp($('#imp'),t=>{ed.value=t;kv.set('doc',t)});
imp($('#mimp'),t=>{mp.value=t.slice(0,4000);saveMath()});

all('[data-x]').forEach(b=>b.onclick=async()=>{
  const fn={pdf:exportPDF,pptx:exportPPTX,doc:exportDOC,txt:exportTXT}[b.dataset.x];
  st('Exporting…');
  try{await fn(ed.value,'homework');st('Exported')}
  catch(e){st('Export failed')}
});

$('#ask').onclick=async()=>{
  if(!ai.ready()) { $('#out').textContent='Load AI first.'; return; }
  const sel=ed.value.slice(ed.selectionStart,ed.selectionEnd)||ed.value;
  $('#out').textContent='Thinking...';
  let t='';
  try{
    for await(const c of ai.stream([
      {role:'system',content:'You are a homework helper. Be concise.'},
      {role:'user',content:`Document:\n${sel.slice(0,2500)}\n\nQuestion: ${$('#q').value}`}
    ])){t+=c;$('#out').textContent=t}
  }catch(e){$('#out').textContent='Error: '+e.message}
};
$('#ins').onclick=()=>{
  if(!$('#out').textContent)return;
  ed.setRangeText('\n'+$('#out').textContent+'\n',ed.selectionEnd,ed.selectionEnd,'end');
  ed.dispatchEvent(new Event('input'));ed.focus();
};

// Math
const mp=$('#mp'),mw=$('#mw'),mo=$('#mo');
let mlast='',mt;
const saveMath=()=>{clearTimeout(mt);mt=setTimeout(()=>{kv.set('mp',mp.value);kv.set('mw',mw.value)},400)};
Promise.all([kv.get('mp'),kv.get('mw')]).then(([p,w])=>{if(typeof p==='string')mp.value=p;if(typeof w==='string')mw.value=w;});
mp.oninput=mw.oninput=saveMath;

const mrun=async(sys,tail)=>{
  if(!ai.ready()) { mo.textContent='Load AI first.'; return; }
  mo.textContent='Thinking...';
  let t='';
  try{
    for await(const c of ai.stream([
      {role:'system',content:sys},
      {role:'user',content:`Problem:\n${mp.value.slice(0,1200)}\n\nWork:\n${mw.value.slice(0,1200)}\n\n${tail}`}
    ])){t+=c;mo.textContent=clean(t)}
  }catch(e){mo.textContent='Error: '+e.message}
  mlast=clean(t);
};

$('#grade').onclick=()=>mrun('Strict math teacher. Do not show reasoning. Reply with: VERDICT, first wrong step, correct answer.','Grade this.');
$('#hint').onclick=()=>mrun('Math tutor. Give one hint only, never the final answer.','Hint.');
$('#solve').onclick=()=>mrun('Math tutor. Solve step by step. Final answer on last line.','Solve.');
$('#stop-math').onclick=ai.stop;
$('#mins').onclick=()=>{
  if(!mlast)return;
  mw.setRangeText('\n'+mlast+'\n',mw.selectionEnd,mw.selectionEnd,'end');
  mw.dispatchEvent(new Event('input'));mw.focus();
};

// Init Mounts
mountChat($('#chat'));
mountPhoto($('#photo'));
mountGrades($('#grades')).catch(e=>console.error(e));

// Re-route clean function for Math/Ask to share
const clean=t=>{
  let s=String(t).replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi,'');
  s=s.replace(/^[\s\S]*<\/think(?:ing)?>/i,'');
  s=s.replace(/<think(?:ing)?>[\s\S]*$/i,'(thinking…)');
  return s.trim();
};
