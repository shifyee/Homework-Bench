// ... (keep kv, dl, ent, importFile the same) ...

export async function exportPDF(html,n){
  const {jsPDF}=await import('jspdf');
  const d=new jsPDF({unit:'pt',format:'letter'});
  
  // Strip HTML for basic PDF generation
  const text=html.replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<\/h[1-6]>/gi,'\n').replace(/<hr\s*\/?>/gi,'\n---\n').replace(/<[^>]+>/g,'');
  let y=56;
  for(const l of d.splitTextToSize(text||' ',520)){
    if(y>740){d.addPage();y=56}
    d.text(l,46,y);y+=15;
  }
  d.save(n+'.pdf');
}

export async function exportPPTX(html,n){
  const P=(await import('pptxgenjs')).default,p=new P();
  // Split by horizontal rule or h1
  const slides=html.split(/<hr\s*\/?>|<h1/i); 
  for(let i=0;i<slides.length;i++){
    let s=slides[i];
    if(!s.trim())continue;
    // Re-add h1 tag if split by it
    if(i>0 && !s.includes('</h1>')) s = 'Heading' + s; 
    
    const text=s.replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<[^>]+>/g,'');
    const [h,...r]=text.trim().split('\n');
    const sl=p.addSlide();
    sl.addText(h||' ',{x:.5,y:.4,w:9,h:.8,fontSize:28,bold:true});
    sl.addText(r.join('\n'),{x:.5,y:1.4,w:9,h:4,fontSize:18,valign:'top'});
  }
  await p.writeFile({fileName:n+'.pptx'});
}

export const exportDOC=(html,n)=>{
  // Wraps the rich text HTML in a valid Word document structure
  const doc=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'><title>Export</title>
  <style>body{font-family:Calibri, sans-serif;font-size:11pt;line-height:1.5;} h1{font-size:20pt;} h2{font-size:16pt;} hr{border:1px dashed #ccc;}</style>
  </head><body>${html}</body></html>`;
  dl(new Blob([doc],{type:'application/msword'}),n+'.doc');
};

export const exportTXT=(html,n)=>{
  const text=html.replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n\n').replace(/<\/h[1-6]>/gi,'\n\n').replace(/<[^>]+>/g,'');
  dl(new Blob([text],{type:'text/plain'}),n+'.txt');
};
