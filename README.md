# Homework Bench

**An offline-first homework PWA.** Import PDFs, Word docs, and PowerPoints; write and export documents; get help from a local AI tutor; have math work graded step-by-step; edit photos; and track grades — all on your own device, with no account, no server, and no data leaving the browser.

After one online visit (to install the app and download the model once), it runs fully offline. Hosted for free on Cloudflare Pages.

> **Status:** personal project, actively used. Expect rough edges; issues and PRs welcome.

---

## Features

- **Documents** — import `.pdf`, `.docx`, `.pptx`, `.txt`, `.md`, `.csv`; edit in a simple editor; export to **PDF, PPTX, Word (.doc), or TXT**. `---` on its own line starts a new slide when exporting PPTX.
- **Local AI tutor** — runs a small DeepSeek (WebLLM) model on your GPU via WebGPU, inside a Web Worker. Ask about the current document, or use it in the math tab.
- **Math check** — paste a DeltaMath problem (or import a PDF/Word file), type your work, and have the AI **grade it**, give a **hint**, or **solve it**. Work is autosaved locally.
- **Photo editor** — brightness, contrast, saturation, blur, grayscale, rotate; export PNG/JPG.
- **Grades** — import a CSV (`course,assignment,score,max`) or add entries manually; see per-course and overall percentages with letter grades and bar charts.
- **Offline-first PWA** — app shell precached by a service worker; model weights cached in IndexedDB. Installable on desktop and Android.
- **Private by design** — no backend, no telemetry. Files are parsed and rendered in the tab; AI inference happens on your GPU.

---

## Requirements

| | |
|---|---|
| **Browser** | Chrome or Edge **119+** (WebGPU + `Promise.withResolvers`) |
| **GPU** | WebGPU-capable; ~2 GB free VRAM for the default model |
| **Storage** | ~2–3 GB free for model weights, plus room for your files |
| **First run** | An internet connection, once, to install the app and download the model |

Everything **except the AI** works in any modern browser. If WebGPU is unavailable, the app says so and disables the AI controls.

---

## Quick start (local)

    git clone https://github.com/<you>/<repo>.git
    cd <repo>
    npm install
    npm run dev

Open the printed localhost URL in Chrome/Edge. The first time:

1. Pick a model in the top bar (default: DeepSeek‑R1‑Distill‑Qwen‑1.5B).
2. Tap **Load AI** and wait for 100%. This downloads and caches the weights.
3. Use the tabs. Reloads after this do not re-download the model.

Production build:

    npm run build     # outputs dist/
    npm run preview   # serve dist/ locally

---

## Deploy to Cloudflare Pages (free)

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Settings:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Environment variable:** `NODE_VERSION=20`
4. Deploy, then open the `*.pages.dev` URL **online** once.
5. Tap **Load AI**, wait for 100%, then install via the browser's *Install app* / *Add to Home Screen*.

No other configuration, server, or secrets are required.

---

## Usage

### Documents
Import a file or type directly. Select text and ask the AI a question — it uses your selection, or the start of the document. **Insert reply** appends the answer to the editor. Use the export buttons for PDF, PPTX, Word, or TXT. The document autosaves in IndexedDB.

### Math check
Paste a problem into **Problem**, put your steps and final answer in **Your work**, then:

- **Grade my work** → verdict (CORRECT / PARTIAL / INCORRECT), first wrong step, correct answer.
- **Hint** → one hint, no final answer.
- **Solve it** → step-by-step solution with the final answer on the last line.
- **Insert reply** → append the AI's response to your work.

DeltaMath has no export, so copy/paste the problem text or import a PDF/Word version.

### Photos
Pick an image, adjust the sliders, rotate, and export. Large images are downscaled to 2048 px on the long edge to keep memory use low.

### Grades
Import a CSV with columns `course,assignment,score,max`, or add rows manually. Header and invalid rows are skipped automatically. **Clear all** deletes the saved grades.

---

## How the offline AI works

- The model runs through `@mlc-ai/web-llm` on WebGPU.
- Inference runs in a **Web Worker**, so the UI thread stays responsive.
- Weights are cached in **IndexedDB** (`useIndexedDBCache: true`) and storage is requested as persistent, so the browser doesn't evict them.
- Only small models (≤ ~3.5 GB VRAM) are offered. `q4f16` builds are used when the GPU supports `shader-f16`; otherwise `q4f32`.
- Context is capped at **2048 tokens** and replies at **700 tokens**.
- Nothing loads until you tap **Load AI**. **Unload AI** frees the memory.

Model IDs come from `prebuiltAppConfig`. The default is DeepSeek‑R1‑Distill‑Qwen‑1.5B, with small Qwen 2.5 and Llama 3.2 fallbacks. You can change the filter in `src/ai.js`.

---

## Project structure

    .
    ├── index.html            # app shell
    ├── vite.config.js        # Vite + PWA config
    ├── public/
    │   └── icon.svg          # app icon (also used by the manifest)
    └── src/
        ├── main.js           # UI wiring, tabs, AI orchestration
        ├── ai.js             # model list, load/unload, streaming
        ├── worker.js         # Web Worker hosting the WebLLM engine
        ├── docs.js           # import/export + IndexedDB key-value store
        ├── photo.js          # canvas photo editor
        ├── grades.js         # grade import, storage, charts
        └── style.css

Heavy libraries (`pdfjs-dist`, `mammoth`, `jszip`, `jspdf`, `pptxgenjs`) are imported dynamically, so they only occupy memory while a file is being read or written.

---

## Troubleshooting

**The model stalls near 90% or the tab crashes.**
Pick a smaller model (Qwen2.5‑0.5B if listed), close other tabs, and retry. Weights are cached in IndexedDB; a crash during the first download can leave a partial cache — clearing site data and reloading fixes it.

**"AI not available" / Load button disabled.**
The browser has no WebGPU. Use Chrome/Edge 119+ on desktop. Everything else still works.

**Offline mode doesn't start.**
The app must be opened online once after deploy so the service worker can precache the shell. Then reload once more before going offline.

**PDF export shows garbled math symbols.**
`jsPDF` uses standard fonts (WinAnsi). Use TXT or Word export for heavy Unicode math.

**A PDF or PPTX imports as empty text.**
Scanned/image-only PDFs contain no text layer, and some PPTX layouts put text in unusual places. The importer extracts text only.

**Grades CSV didn't import.**
Expected format is exactly `course,assignment,score,max`, one row per line. Header rows are skipped; rows with a non-numeric score or `max <= 0` are ignored.

---

## Privacy

- No accounts, analytics, or network calls after the model is cached.
- Imported files are read locally in the browser.
- Documents, math work, and grades are stored in IndexedDB on your device.
- AI inference runs on your GPU. Nothing is sent to a server.
- Clearing site data removes cached models, documents, and grades.

---

## Tech stack

Vite · vite-plugin-pwa (Workbox) · @mlc-ai/web-llm · pdf.js · mammoth · JSZip · jsPDF · PptxGenJS · plain JavaScript and CSS.

---

## Contributing

Small, focused PRs are welcome. Please open an issue first for anything larger than a bug fix. Keep the app dependency-light and offline-first; avoid adding anything that requires a backend.

---

## License

MIT — see `LICENSE`.
