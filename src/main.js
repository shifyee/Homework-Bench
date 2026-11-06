import './style.css';
import {registerSW} from 'virtual:pwa-register';
import * as ai from './ai.js';
import {importFile,exportPDF,exportPPTX,exportDOC,exportTXT,kv} from './docs.js';
import {mountPhoto} from './photo.js';
import {mountGrades} from './grades.js';
import {mountChat} from './chat.js';

registerSW({immediate:true});

const $=s=>document.querySelector(s),all=s=>document.querySelectorAll(s),st=t=>$('#st').textContent=t;

// Navigation & Tab Routing
all('nav button').forEach(b=>b.onclick=()=>{
  all('nav button').forEach(x=>x.classList.toggle('active',x===b));
  all('main section').forEach(s=>s.hidden=s.id!==b.dataset.t);
});

// Setup AI
(async()=>{
  let list=null;
  try{list=await ai.models()}catch(e){console.warn(e)}
  if(!list){
    st('No WebGPU. AI disabled.');$('#load').disabled=true;
    $('#model').innerHTML='<option>AI not available</option>';return;
  }
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
  }catch(e){ st('Load failed: '+(e?.message||e)); }
  $('#prog-wrap').hidden=true;$('#load').disabled=false;
};

$('#unload').onclick=async()=>{
  $('#unload').disabled=true; await ai.unload();
  $('#unload').hidden=true;$('#unload').disabled=false; st('Unloaded');
};

// Documents & Rich Text Editor
const ed=$('#ed');let tm,last='';
kv.get('doc').then(v=>{if(typeof v==='string')ed.innerHTML=v});
ed.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>kv.set('doc',ed.innerHTML),400)};

// Toolbar commands
all('[data-cmd]').forEach(btn=>btn.onclick=()=>{
  const cmd=btn.dataset.cmd;
  if(cmd==='formatBlock') document.execCommand(cmd,false,btn.dataset.val);
  else document.execCommand(cmd,false,null);
  ed.focus();
});

const imp=(input,set)=>input.onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  st('Reading '+f.name+'…');
  try{set(await importFile(f));st('')} catch(x){st('Error: '+(x?.message||x))}
  e.target.value='';
};

imp($('#imp'),html=>{
  // Import plain text and wrap in paragraphs for the rich editor
  const text=html.replace(/</g,'&lt;').replace(/>/g,'&gt;').split('\n\n').map(p=>`<p>${p.replace(/\n/g,'<br>')}</p>`).join('');
  ed.innerHTML=text; kv.set('doc',text);
});
imp($('#mimp'),t=>{mp.value=t.slice(0,4000);saveMath()});

all('[data-x]').forEach(b=>b.onclick=async()=>{
  const fn={pdf:exportPDF,pptx:exportPPTX,doc:exportDOC,txt:exportTXT}[b.dataset.x];
  st('Exporting…');
  try{await fn(ed.innerHTML,'homework');st('Exported')} catch(e){st('Export failed')}
});

$('#ask').onclick=async()=>{
  if(!ai.ready()) { $('#out').hidden=false; $('#out').textContent='Load AI first.'; return; }
  // Use selection or whole doc text
  const sel=window.getSelection().toString()||ed.innerText;
  $('#out').hidden=false; $('#out').textContent='Thinking...';
  let t='';
  try{
    for await(const c of ai.stream([
      {role:'system',content:'You are an AI document assistant. Help edit, rewrite, or answer questions based on the provided HTML document. Output only the requested text.'},
      {role:'user',content:`Document Context:\n${sel.slice(0,3000)}\n\nInstruction: ${$('#q').value}`}
    ])){t+=c;$('#out').textContent=t}
  }catch(e){$('#out').textContent='Error: '+e.message}
};
$('#ins').onclick=()=>{
  if(!$('#out').textContent)return;
  const html=`<p>${$('#out').textContent.replace(/\n/g,'<br>')}</p>`;
  document.execCommand('insertHTML',false,html);
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
    ])){t+=c;mo.textContent=t}
  }catch(e){mo.textContent='Error: '+e.message}
  mlast=t;
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
