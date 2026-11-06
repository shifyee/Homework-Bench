import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  build:{target:'es2022'},
  worker:{format:'es'},
  // web-llm ships its own ESM + wasm. Pre-bundling it breaks the worker/wasm
  // URL resolution and the engine fails to boot — leave it untouched.
  optimizeDeps:{exclude:['@mlc-ai/web-llm']},
  plugins:[VitePWA({
    registerType:'autoUpdate',
    // Precache the app shell (JS/wasm/worker) so it boots with zero network.
    // Model weights are NOT precached — web-llm keeps them in IndexedDB.
    workbox:{globPatterns:['**/*.{js,mjs,css,html,svg,png,wasm}'],maximumFileSizeToCacheInBytes:20*1024*1024},
    manifest:{
      name:'Offline Homework',short_name:'HW',display:'standalone',start_url:'/',
      background_color:'#eef2f7',theme_color:'#14213d',
      icons:[{src:'icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]
    }
  })]
});
