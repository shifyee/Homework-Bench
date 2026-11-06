# Homework Bench (offline PWA)

Documents (PDF / Word / PowerPoint in, PDF / PPTX / Word / TXT out), a local
DeepSeek tutor + math grader, photo editor, grade charts. After one online visit
it all runs offline. Free hosting on Cloudflare Pages.

## Deploy on Cloudflare Pages
1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Build command `npm run build`, output directory `dist`, env `NODE_VERSION=20`.
4. Open the `*.pages.dev` URL once **online**, pick a model, tap **Load AI**, wait for 100%.
5. Install it ("Add to Home Screen"). From then on everything works offline.

## Why it no longer crashes at ~90%
- Model weights go through **IndexedDB** (`useIndexedDBCache: true`) and storage is
  marked persistent — the default Cache API path is what stalls near the end.
- Only **≤ 3.5 GB** q4 models are offered; `q4f16` only when the GPU has `shader-f16`.
- The engine lives in a **Web Worker**; context is capped at 2048 tokens, replies at 700.
- `vite.config.js` sets `optimizeDeps.exclude: ['@mlc-ai/web-llm']` so the worker and
  wasm URLs are not rewritten by Vite (a broken wasm load also looks like a crash).
- Nothing loads until you tap **Load AI**; **Unload AI** frees the memory.

If it still dies: pick the smallest model (Qwen2.5‑0.5B if listed), close other tabs,
and use desktop Chrome/Edge 119+ (WebGPU + `Promise.withResolvers`). If the dropdown
says "AI not available", the browser has no WebGPU — everything except the AI still works.

## Notes
- Model IDs come from `prebuiltAppConfig`; the default is DeepSeek‑R1‑Distill‑Qwen‑1.5B,
  with small Qwen/Llama fallbacks.
- DeltaMath has no export, so paste the problem text (or import a PDF) in **Math check**.
- PDF export uses standard fonts (WinAnsi), so use TXT/DOC for heavy Unicode math.
- Word export is an HTML `.doc`; PowerPoint export uses `---` on its own line to split slides.
