import {CreateWebWorkerMLCEngine,prebuiltAppConfig} from '@mlc-ai/web-llm';

let eng,wk;

export async function models(){
  if(!navigator.gpu?.requestAdapter)return null;
  const adapter=await navigator.gpu.requestAdapter().catch(()=>null);
  if(!adapter)return null;
  
  const q=adapter.features?.has?.('shader-f16')?'q4f16':'q4f32';
  
  // Return ALL available models matching the GPU capability
  return prebuiltAppConfig.model_list
    .filter(m => m.model_id.includes(q))
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
  await navigator.storage?.persist?.();

  wk=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  const appConfig={...prebuiltAppConfig,useIndexedDBCache:true};
  
  try{
    eng=await CreateWebWorkerMLCEngine(
      wk,id,
      {appConfig,initProgressCallback:onProgress},
      {context_window_size:4096} // Increased for chat tab
    );
  }catch(e){
    await unload();
    throw e;
  }
}

export async function* stream(messages){
  if(!eng)throw new Error('AI is not loaded');
  const s=await eng.chat.completions.create({
    messages, stream:true, max_tokens:1500, temperature:.7
  });
  for await(const c of s) yield c.choices[0]?.delta?.content||'';
}

export const stop=()=>{try{eng?.interruptGenerate()}catch{}};
