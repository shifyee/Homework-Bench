import {dl} from './docs.js';
export function mountPhoto(root){
  const S=[['br','Brightness',50,150,100],['ct','Contrast',50,150,100],['sa','Saturation',0,200,100],['bl','Blur',0,10,0]];
  root.innerHTML=`<div class="row"><input type="file" accept="image/*" id="pf"><span class="dim">Everything runs on your device; nothing is uploaded.</span></div>
  <div class="row">${S.map(([i,l,a,b,v])=>`<label>${l} <input type="range" id="${i}" min="${a}" max="${b}" value="${v}"></label>`).join('')}<label><input type="checkbox" id="gs"> Black and white</label></div>
  <div class="row"><button id="rot">Rotate</button><button id="reset">Reset</button><button id="png">Save PNG</button><button id="jpg">Save JPG</button></div>
  <canvas id="cv" width="1" height="1"></canvas>`;
  const $=s=>root.querySelector(s),cv=$('#cv'),cx=cv.getContext('2d');
  let img,rot=0;
  const draw=()=>{
    if(!img)return;
    // Cap the canvas: multi-megapixel images are what eat RAM on phones.
    const s=Math.min(1,2048/Math.max(img.width,img.height)),w=img.width*s,h=img.height*s,odd=rot%2;
    cv.width=odd?h:w;cv.height=odd?w:h;
    cx.filter=`brightness(${$('#br').value}%) contrast(${$('#ct').value}%) saturate(${$('#sa').value}%) blur(${$('#bl').value}px) grayscale(${$('#gs').checked?1:0})`;
    cx.translate(cv.width/2,cv.height/2);
    cx.rotate(rot*Math.PI/2);
    cx.drawImage(img,-w/2,-h/2,w,h);
    cx.setTransform(1,0,0,1,0,0);
  };
  root.addEventListener('input',draw);
  $('#pf').onchange=async e=>{
    const f=e.target.files[0];if(!f)return;
    img?.close?.();
    img=await createImageBitmap(f);
    rot=0;draw();
  };
  $('#rot').onclick=()=>{rot=(rot+1)%4;draw()};
  $('#reset').onclick=()=>{S.forEach(s=>{$('#'+s[0]).value=s[4]});$('#gs').checked=false;rot=0;draw()};
  $('#png').onclick=()=>cv.toBlob(b=>b&&dl(b,'photo.png'),'image/png');
  $('#jpg').onclick=()=>cv.toBlob(b=>b&&dl(b,'photo.jpg'),'image/jpeg',.92);
}
