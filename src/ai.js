import {CreateWebWorkerMLCEngine,prebuiltAppConfig} from '@mlc-ai/web-llm';

let eng,wk;
const MAX_VRAM_MB=3500; // anything bigger is what turns a tab into an OOM crash

// Only small q4 models; f16 builds use half the memory of f32, so prefer them
// when the GPU supports the feature.
export async function models(){
  if(!navigator.gpu?.requestAdapter)return null;
  const adapter=await navigator.gpu.requestAdapter().catch(()=>null);
  if(!adapter)return null;
  const q=adapter.features?.has?.('shader-f16')?'q4f16':'q4f32';
  return prebuiltAppConfig.model_list
    .filter(m=>m.model_id.includes(q)&&(m.vram_required_MB||0)<=MAX_VRAM_MB)
    .filter(m=>/deepseek|Qwen2\.5-(0\.5|1\.5)B-Instruct|Llama-3\.2-1B/i.test(m.model_id))
    .sort((x,y)=>(x.vram_required_MB||0)-(y.vram_required_MB||0));
}

export const ready=()=>!!eng;

export async function unload(){
  try{await eng?.unload()}catch{}
  try{wk?.terminate()}catch{}
  eng=wk=null;
}

export async function load(id,onProgress){
  await unload();
  // Ask the browser not to evict the model weights.
  await navigator.storage?.persist?.();

  // Heads-up (not fatal) when the origin has less room than the model needs.
  try{
    const rec=prebuiltAppConfig.model_list.find(m=>m.model_id===id);
    const need=(rec?.vram_required_MB||1500)*1.5*1024*1024;
    const est=await navigator.storage?.estimate?.();
    if(est?.quota&&est.quota-est.usage<need)console.warn('Low storage for model cache',est);
  }catch{}

  wk=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  // IndexedDB streams shards one at a time; the default Cache API path is what
  // stalls near 90% for many people.
  const appConfig={...prebuiltAppConfig,useIndexedDBCache:true};
  try{
    eng=await CreateWebWorkerMLCEngine(
      wk,id,
      {appConfig,initProgressCallback:onProgress},
      {context_window_size:2048}
    );
  }catch(e){await unload();throw e}
}

export async function* stream(messages){
  if(!eng)throw new Error('AI is not loaded');
  const s=await eng.chat.completions.create({messages,stream:true,max_tokens:700,temperature:.3});
  for await(const c of s)yield c.choices[0]?.delta?.content||'';
}

export const stop=()=>{try{eng?.interruptGenerate()}catch{}};
