import {WebWorkerMLCEngineHandler} from '@mlc-ai/web-llm';
// model + GPU buffers live here, off the UI thread
const h=new WebWorkerMLCEngineHandler();
self.onmessage=m=>h.onmessage(m);
