import {marked} from 'marked';
import * as ai from './ai.js';

const clean=t=>{
  let s=String(t).replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi,'');
  s=s.replace(/^[\s\S]*<\/think(?:ing)?>/i,'');
  s=s.replace(/<think(?:ing)?>[\s\S]*$/i,'(thinking…)');
  return s.trim();
};

export function mountChat(root){
  const historyEl=root.querySelector('#chat-history');
  const inputEl=root.querySelector('#chat-input');
  const sendBtn=root.querySelector('#chat-send');
  const stopBtn=root.querySelector('#chat-stop');
  
  let messages=[];
  let isGenerating=false;

  const render=()=>{
    if(messages.length===0){
      historyEl.innerHTML=`
        <div class="welcome-screen">
          <h1>How can I help you today?</h1>
          <p>I am running entirely on your device. Ask me to explain concepts, solve problems, or write essays.</p>
        </div>
      `;
      return;
    }
    historyEl.innerHTML=messages.map(m=>`
      <div class="message-row ${m.role}">
        ${m.role==='assistant'?'<div class="avatar ai-avatar">AI</div>':''}
        <div class="message-bubble">${m.role==='assistant'?marked.parse(clean(m.content)):marked.parse(m.content)}</div>
        ${m.role==='user'?'<div class="avatar user-avatar">You</div>':''}
      </div>
    `).join('');
    historyEl.scrollTop=historyEl.scrollHeight;
  };

  render();

  const autoResize=()=>{
    inputEl.style.height='auto';
    inputEl.style.height=(inputEl.scrollHeight)+'px';
  };
  inputEl.addEventListener('input',autoResize);

  const send=async()=>{
    if(isGenerating||!inputEl.value.trim())return;
    const text=inputEl.value.trim();
    inputEl.value=''; autoResize();
    
    messages.push({role:'user',content:text});
    render();
    
    if(!ai.ready()){
      messages.push({role:'assistant',content:'**Please load the AI model from the sidebar first.**'});
      render();
      return;
    }

    isGenerating=true;
    sendBtn.hidden=true; stopBtn.hidden=false;
    
    messages.push({role:'assistant',content:''});
    const msgIndex=messages.length-1;
    
    try{
      for await(const chunk of ai.stream(messages)){
        messages[msgIndex].content+=chunk;
        // Update just the last bubble for performance
        const bubbles=historyEl.querySelectorAll('.message-bubble');
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
