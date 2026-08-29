# SatQuery AI

## An Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis through Text Queries

SatQuery AI is a software-based agentic vision-language assistant for analysing single and paired remote-sensing images through natural-language queries.

The system aims to allow users to ask questions about remote-sensing imagery without requiring them to manually select specialised satellite-analysis workflows.

## Initial System

The initial implementation focuses on:

- Natural-language query understanding
- Query validation
- Task routing
- Satellite-data retrieval
- Image preprocessing
- NDVI-based vegetation analysis
- NDWI-based water analysis
- Change detection
- Vision-language based question answering
- Evidence-grounded results
- Map and result visualization

## Planned Extensions

The system can progressively incorporate:

- Advanced change detection
- Vision-language models
- Multitemporal reasoning
- SAR imagery
- Optical-SAR analysis
- Remote-sensing model adaptation
- Agentic routing
- Evidence fusion

## Architecture

User Query
    ↓
Query Understanding
    ↓
Input Validation
    ↓
Task Router
    ↓
Specialist Analysis
    ↓
Evidence Extraction
    ↓
Grounded Response
    ↓
Visualization

## Repository Structure

backend/     → FastAPI backend, routing and system services

frontend/    → Next.js/React user interface

ml/          → Remote-sensing analysis and VLM components

data/        → Datasets and satellite-data workspace

outputs/     → Generated analysis outputs

docs/        → Project documentation

tests/       → Tests

## Technology

### Backend
- Python
- FastAPI
- Pydantic
- HTTPX

### Machine Learning
- Python
- PyTorch
- Hugging Face Transformers
- Hugging Face Datasets
- Rasterio
- NumPy
- OpenCV
- scikit-image
- SciPy

### Frontend
- TypeScript
- Next.js
- React
- Tailwind CSS

## Development

Python dependencies can be installed using:

pip install -r requirements.txt

Frontend dependencies are managed separately inside the frontend project.
