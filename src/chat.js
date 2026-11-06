import {marked} from 'marked';
import * as ai from './ai.js';
import {kv} from './docs.js';

const clean=t=>{
  let s=String(t).replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi,'');
  s=s.replace(/^[\s\S]*<\/think(?:ing)?>/i,'');
  s=s.replace(/<think(?:ing)?>[\s\S]*$/i,'(thinking…)');
  return s.trim();
};

export function mountChat(root){
  const $=s=>document.querySelector(s);
  const historyEl=$('#chat-history'), inputEl=$('#chat-input'), sendBtn=$('#chat-send'), stopBtn=$('#chat-stop');
  
  let messages=[{role:'system', content:'You are a helpful and brilliant AI tutor. Always format math with LaTeX and code with markdown blocks. Be concise.'}];
  let isGenerating=false;

  const render=()=>{
    historyEl.innerHTML=messages.filter(m=>m.role!=='system').map(m=>`
      <div class="message ${m.role}">
        <div class="avatar">${m.role==='user'?'You':'AI'}</div>
        <div class="bubble">${m.role==='assistant'?marked.parse(clean(m.content)):marked.parse(m.content)}</div>
      </div>
    `).join('');
    historyEl.scrollTop=historyEl.scrollHeight;
  };

  const send=async()=>{
    if(isGenerating || !inputEl.value.trim()) return;
    const text=inputEl.value.trim();
    inputEl.value='';
    
    messages.push({role:'user', content:text});
    render();
    
    if(!ai.ready()){
      messages.push({role:'assistant', content:'**Please load the AI model from the sidebar first.**'});
      render();
      return;
    }

    isGenerating=true;
    sendBtn.hidden=true; stopBtn.hidden=false;
    
    messages.push({role:'assistant', content:''});
    const msgIndex=messages.length-1;
    
    try{
      for await(const chunk of ai.stream(messages)){
        messages[msgIndex].content+=chunk;
        // Update only the last bubble for performance
        const bubbles=historyEl.querySelectorAll('.bubble');
        bubbles[bubbles.length-1].innerHTML=marked.parse(clean(messages[msgIndex].content));
        historyEl.scrollTop=historyEl.scrollHeight;
      }
    }catch(e){
      messages[msgIndex].content+=`\n\n**Error:** ${e.message}`;
    }
    
    isGenerating=false;
    sendBtn.hidden=false; stopBtn.hidden=true;
    render();
  };

  sendBtn.onclick=send;
  inputEl.onkeydown=e=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}
  };
  stopBtn.onclick=()=>{
    ai.stop();
    isGenerating=false; sendBtn.hidden=false; stopBtn.hidden=true;
  };
}
