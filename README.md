SatQuery AI

An Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis through Text Queries

Built for Smart India Hackathon 2026 — Problem Statement 26167 (Space Technology)

SatQuery AI lets users upload satellite imagery and ask natural-language questions about it. An agentic router interprets each query, automatically selects the right specialist model (spectral analysis, change detection, or vision-language reasoning), and returns an evidence-grounded answer — no GIS expertise or manual tool selection required.

Table of Contents
Architecture
Tech Stack
Prerequisites
Setup
Running the Project
Environment Variables
Testing
Project Structure
Datasets & References
License
Team
Architecture
User → Frontend → Preprocessing (validation, resize) → Intelligent Router
                                                              │
                        ┌──────────────┬──────────────┬──────┴───────┐
                        ▼              ▼              ▼              ▼
                  NDVI/NDWI/NDBI  Change Detection  ChangeFormer   VQA / Captioning
                  (Person B)      (Person B)         (Person B)    (Person C)
                        │              │              │              │
                        └──────────────┴──────────────┴──────────────┘
                                        ▼
                          Evidence Assembly + Confidence Scoring
                                        ▼
                              Natural-Language Answer → User

The router uses a 4-tier semantic matcher (compound patterns → direct keywords → domain synonyms → VQA fallback) to decide which specialist tool(s) to invoke, then combines their outputs into a single evidence-grounded response.

Tech Stack
Layer	Technology
Frontend	HTML5, CSS3, Vanilla JavaScript, IndexedDB
Preprocessing	Node.js, Express, Sharp, Multer
Router / Orchestration	Python, FastAPI, Pydantic, Uvicorn, HTTPX
Spectral & Change Analysis	Python, Rasterio, NumPy, OpenCV, scikit-image, SciPy, Matplotlib
Change Detection (DL)	ChangeFormer (PyTorch, MIT-licensed, third-party)
Vision-Language (prototype)	Moondream2 (via Transformers, Accelerate)
Vision-Language (final/RS-adapted)	GeoChat-7B, LoRA/QLoRA
Evaluation	VRSBench, RSVQA, CDVQA
Prerequisites
Node.js and npm
Python 3.11+ (developed/tested on 3.13, with a separate .venv)
Git
NVIDIA GPU recommended (CUDA) — 6GB+ VRAM for local Moondream2 inference; CPU fallback supported but slower
~4 GB free disk space for Moondream2 weights (GeoChat weights only needed for the final ML/fine-tuning pipeline)
Setup
1. Clone the repository
bash
git clone https://github.com/GarimaS06/SatQuery-AI.git
cd SatQuery-AI
2. Root Python dependencies (router, spectral analysis, VLM)
bash
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
3. Preprocessing service (Node.js)
bash
cd preprocessing
npm install
cp .env.example .env
4. Moondream2 weights (one-time download, ~4 GB)
bash
python -c "from huggingface_hub import snapshot_download; \
snapshot_download('vikhyatk/moondream2', revision='2025-06-21', local_dir='weights/moondream2')"

Moondream2 requires trust_remote_code=True when loaded via Transformers (ships custom modeling code) — handled internally by the adapter.

5. ChangeFormer (third-party, MIT-licensed)

ChangeFormer/requirements.txt is a Conda environment export (Linux-64, Python 3.8), not a pip-installable file. If setting up ChangeFormer training/inference standalone, use:

bash
conda create --name changeformer --file ChangeFormer/requirements.txt

For running SatQuery AI's integrated changeformer_tool.py, this isn't required separately — it uses the project's main Python environment and a pretrained checkpoint under checkpoints/ChangeFormer_LEVIR/.

GeoChat-7B setup is required only for the final remote-sensing-adapted evaluation/fine-tuning path — not needed to run the local prototype.

Running the Project

Start each service in a separate terminal:

Terminal 1 — Preprocessing (Port 4000)

bash
cd preprocessing
npm start

Terminal 2 — Router (Port 8000)

bash
uvicorn backend.router.main:app --host 0.0.0.0 --port 8000 --reload

Terminal 3 — Frontend (Port 3000)

bash
python -m http.server 3000 -d frontend

Access at http://localhost:3000/app.html (or index.html).

Quick health check
bash
curl http://localhost:4000/health
curl http://localhost:8000/health
Environment Variables
preprocessing/.env.example
Variable	Default	Description
PORT	4000	Preprocessing server port
ROUTER_ENABLED	false	Set true to forward requests to the router
ROUTER_URL	http://localhost:8000/api/router/analyze	Router target endpoint
MAX_FILE_SIZE_MB	25	Max upload size
MAX_IMAGE_WIDTH / MAX_IMAGE_HEIGHT	2048	Max resize dimensions
Codebase-level
Variable	Default	Used in
PERSON_C_BACKEND	moondream2	ml/person_c/ — mock | moondream2 | geochat
PERSON_C_MODEL_PATH	Hugging Face hub ID vikhyatk/moondream2@2025-06-21	ml/person_c/
CHANGEFORMER_ROOT	<project_root>/ChangeFormer	person_b/changeformer_tool.py
OPENAI_API_KEY	—	ml/person_c/evaluation.py (only for --judge official-gpt)
Testing
Module	Command	Result
Preprocessing	node preprocessing/test/runTests.js	14/14 passed
Person C (VQA/Captioning)	python -m unittest discover -s tests/person_c	68/68 passed
Router (mock backend)	$env:PERSON_C_BACKEND="mock"; pytest backend/router/tests	29/29 passed
Router (default backend)	pytest backend/router/tests	27/29 passed*
Person B (band loader)	python person_b/test_band_loader.py data/stacked_sample.tif	1/1 passed

* 2 tests fail on default backend if Moondream2 weights aren't downloaded locally yet — run with PERSON_C_BACKEND=mock for a clean pass without requiring model weights, or download weights first (see Setup step 4).

Project Structure
SatQuery-AI/
├── backend/router/          # Agentic routing & orchestration (FastAPI)
├── ChangeFormer/             # Third-party ChangeFormer model (MIT license)
├── checkpoints/               # Pretrained model checkpoints
├── data/                     # Sample datasets (e.g. stacked_sample.tif)
├── docs/person_c.md          # Person C module documentation
├── frontend/                  # UI (app.html, project.html, app.js)
├── ml/person_c/               # VQA & Captioning (Moondream2 / GeoChat adapters)
├── outputs/                   # Generated analysis outputs (maps, overlays)
├── person_b/                  # NDVI, NDWI, NDBI, Change Detection, ChangeFormer tool
├── preprocessing/              # Image/question validation & standardization
├── tests/person_c/            # Person C test suite
└── requirements.txt           # Root Python dependencies
Datasets & References
BigEarthNet — multimodal Sentinel-1/Sentinel-2 dataset, planned fine-tuning corpus for remote-sensing adaptation
VRSBench — evaluation benchmark for captioning, grounding, and VQA
RSVQA — evaluation benchmark for remote-sensing visual question answering
CDVQA — evaluation benchmark for change-based visual question answering
License

This project's own code does not yet declare a root license. The bundled ChangeFormer module (ChangeFormer/) is third-party and MIT-licensed — see ChangeFormer/LICENSE.

Team — NOCTURNUM
Role	Focus
Person A	Preprocessing & Input Validation
Person B	Spectral Analysis & Change Detection (NDVI/NDWI/NDBI, ChangeFormer)
Person C	Vision-Language: VQA & Captioning (Moondream2 / GeoChat)
Person D	Agentic Router & Orchestration
Person E	Frontend / UI
Status

Prototype stage — Round 1, Smart India Hackathon 2026. Preprocessing, routing, spectral analysis, and change detection (classical + ChangeFormer) are implemented and tested end-to-end. VQA/captioning run on Moondream2 as a local prototype backend; GeoChat-7B fine-tuning on BigEarthNet is the planned path for the final remote-sensing-adapted model.