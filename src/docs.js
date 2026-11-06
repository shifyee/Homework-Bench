// Heavy libraries are imported on demand so they only occupy RAM while used.
const open=()=>new Promise((res,rej)=>{
  const q=indexedDB.open('hw',1);
  q.onupgradeneeded=()=>{const d=q.result;if(!d.objectStoreNames.contains('k'))d.createObjectStore('k')};
  q.onsuccess=()=>res(q.result);
  q.onerror=()=>rej(q.error);
});

export const kv={
  async get(k){
    const d=await open();
    return new Promise(r=>{const q=d.transaction('k').objectStore('k').get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r(undefined)});
  },
  async set(k,v){
    const d=await open();
    return new Promise((r,j)=>{const t=d.transaction('k','readwrite');t.objectStore('k').put(v,k);t.oncomplete=r;t.onerror=()=>j(t.error)});
  }
};

export const dl=(blob,name)=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),3e4);
};

const ent=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');

export async function importFile(f){
  const n=f.name.toLowerCase(),b=await f.arrayBuffer();

  if(n.endsWith('.pdf')){
    const pdfjs=await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    const d=await pdfjs.getDocument({data:b}).promise,t=[];
    try{
      for(let i=1;i<=d.numPages;i++){
        const p=await d.getPage(i);
        t.push((await p.getTextContent()).items.map(x=>x.str).join(' '));
        p.cleanup(); // one page in memory at a time
      }
    }finally{await d.destroy()}
    return t.join('\n\n');
  }

  if(n.endsWith('.docx')){
    const mod=await import('mammoth');
    const m=mod.default||mod;
    return (await m.extractRawText({arrayBuffer:b})).value;
  }

  if(n.endsWith('.pptx')){
    const z=await (await import('jszip')).default.loadAsync(b);
    const num=k=>parseInt(k.match(/(\d+)\.xml$/)[1],10);
    const ks=Object.keys(z.files).filter(k=>/^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((x,y)=>num(x)-num(y));
    const out=[];
    for(const k of ks){
      const x=await z.file(k).async('string');
      // group runs by paragraph, and allow <a:t xml:space="preserve">
      let paras=[...x.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)]
        .map(p=>[...p[1].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(m=>ent(m[1])).join(''));
      if(!paras.length)paras=[...x.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(m=>ent(m[1]));
      out.push(paras.join('\n'));
    }
    return out.join('\n\n---\n\n');
  }

  if(/\.(txt|md|csv)$/.test(n))return new TextDecoder().decode(b);
  throw new Error('Unsupported file type: '+n);
}

export async function exportPDF(t,n){
  const {jsPDF}=await import('jspdf');
  const d=new jsPDF({unit:'pt',format:'letter'});
  let y=56;
  for(const l of d.splitTextToSize(t||' ',520)){
    if(y>740){d.addPage();y=56}
    d.text(l,46,y);y+=15;
  }
  d.save(n+'.pdf');
}

export async function exportPPTX(t,n){
  const P=(await import('pptxgenjs')).default,p=new P();
  for(const s of (t||'').split(/\n-{3,}\n/)){
    const [h,...r]=s.trim().split('\n');
    const sl=p.addSlide();
    sl.addText(h||' ',{x:.5,y:.4,w:9,h:.8,fontSize:28,bold:true});
    sl.addText(r.join('\n'),{x:.5,y:1.4,w:9,h:4,fontSize:18,valign:'top'});
  }
  await p.writeFile({fileName:n+'.pptx'});
}

export const exportDOC=(t,n)=>dl(new Blob(
  ['<html><meta charset="utf-8"><body style="font-family:Calibri">'+
    String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')+
   '</body></html>'],
  {type:'application/msword'}),n+'.doc');

export const exportTXT=(t,n)=>dl(new Blob([t||''],{type:'text/plain'}),n+'.txt');
