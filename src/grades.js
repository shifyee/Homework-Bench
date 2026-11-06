import {kv} from './docs.js';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const letter=p=>p>=90?'A':p>=80?'B':p>=70?'C':p>=60?'D':'F';
const cleanRow=r=>r&&typeof r.c==='string'&&Number.isFinite(+r.s)&&+r.m>0
  ?{c:r.c,a:r.a||'-',s:+r.s,m:+r.m}:null;

export async function mountGrades(root){
  let rows=((await kv.get('grades'))||[]).map(cleanRow).filter(Boolean);
  root.innerHTML=`<div class="row"><input type="file" id="gf" accept=".csv"><span class="dim">CSV columns: course,assignment,score,max</span></div>
  <div class="row"><input id="gc" placeholder="Course"><input id="ga" placeholder="Assignment"><input id="gsc" type="number" placeholder="Score" style="width:90px"><input id="gm" type="number" placeholder="Out of" style="width:90px"><button id="gadd">Add</button><button id="gclr">Clear all</button></div>
  <div id="gv"></div>`;
  const $=s=>root.querySelector(s),save=()=>kv.set('grades',rows);

  const draw=()=>{
    if(!rows.length){$('#gv').innerHTML='<p class="dim">No grades yet. Import a CSV or add one above.</p>';return}
    const by={};
    for(const r of rows){
      if(!by[r.c])by[r.c]={s:0,m:0,a:[]};
      const c=by[r.c];c.s+=r.s;c.m+=r.m;c.a.push(r);
    }
    const tot=Object.values(by).reduce((t,c)=>({s:t.s+c.s,m:t.m+c.m}),{s:0,m:0});
    const op=tot.m?tot.s/tot.m*100:0;
    $('#gv').innerHTML=`<div class="c"><h3><span>Overall</span><span>${op.toFixed(1)}% ${letter(op)}</span></h3><div class="bar"><i style="width:${Math.min(100,op)}%"></i></div></div>`+
      Object.entries(by).map(([n,c])=>{
        const p=c.m?c.s/c.m*100:0;
        return `<div class="c"><h3><span>${esc(n)}</span><span>${p.toFixed(1)}% ${letter(p)}</span></h3><div class="bar"><i style="width:${Math.min(100,p)}%"></i></div>
        ${c.a.map(a=>{const q=a.m?a.s/a.m*100:0;
          return `<div class="row dim" style="margin-top:6px"><span style="flex:1">${esc(a.a)}</span><span>${a.s}/${a.m}</span><div class="bar" style="width:120px"><i style="width:${Math.min(100,q)}%"></i></div></div>`;
        }).join('')}</div>`;
      }).join('');
  };

  const add=async()=>{
    const c=$('#gc').value.trim(),s=+$('#gsc').value,m=+$('#gm').value;
    if(!c||!(m>0)||!Number.isFinite(s))return;
    rows.push({c,a:$('#ga').value.trim()||'-',s,m});
    await save();draw();
    $('#ga').value='';$('#gsc').value='';$('#gm').value='';$('#gc').focus();
  };

  $('#gf').onchange=async e=>{
    const f=e.target.files[0];if(!f)return;
    const txt=(await f.text()).replace(/^\uFEFF/,'');
    for(const line of txt.split(/\r?\n/)){
      if(!line.trim())continue;
      const [c,a,s,m]=line.split(',').map(x=>x.trim());
      const row=cleanRow({c,a,s,m});
      if(row)rows.push(row); // headers / junk rows are skipped, never guessed
    }
    await save();draw();e.target.value='';
  };
  $('#gadd').onclick=add;
  for(const id of ['#gc','#ga','#gsc','#gm'])$(id).addEventListener('keydown',e=>{if(e.key==='Enter')add()});
  $('#gclr').onclick=async()=>{if(confirm('Delete all grades?')){rows=[];await save();draw()}};
  draw();
}
