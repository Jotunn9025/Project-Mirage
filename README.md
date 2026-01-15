# XAI Personality Engine

An advanced Explainable AI (XAI) system that analyzes voice patterns in real-time to generate transparent, adaptive personality strategies. The system provides a clear rationale for every decision it makes.

## Prerequisites

- Python 3.9+
- Node.js 16+
- Groq API Key (get from https://console.groq.com)
- HuggingFace API Token (get from https://huggingface.co/settings/tokens)

## Installation

### 1. Backend Setup

Navigate to the backend directory:
```bash
cd backend
```

Install dependencies:
```bash
pip install -r requirements.txt
```

Create a .env file and add your API keys:
```
GROQ_API_KEY=your_groq_api_key_here
HF_API_TOKEN=your_huggingface_token_here
```

### 2. Frontend Setup

Navigate to the frontend directory:
```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

## Running the Application

### 1. Start the Backend

From the backend directory:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start the Frontend

From the frontend directory in a new terminal:
```bash
npm run dev
```

The application will be available at http://localhost:5173 (or as shown in the terminal).

## Project Structure

- backend/ - FastAPI server and AI logic
- frontend/ - React application with real-time audio analysis
- setup.ps1 - Automated setup script for Windows

## Voice Features Analysis

The system extracts the following metrics from voice input:
- Energy: Volume and intensity
- Confidence: Steadiness and assertiveness
- Stress: Tension and anxiety markers
- Tempo: Speaking speed
- Clarity: Articulation quality

## Transparent Decision Layers

The AI adapts its personality across multiple dimensions:
- Tone Layer: warm supportive, calm steady, grounded enthusiastic, confident reassuring, etc.
- Behavior Layer: deliberate slow, energizing quick, matched rhythm, etc.
- Helpfulness Layer: minimal guidance, detailed scaffolding, strategic hints, etc.
- Emotional Layer: expressive warm, contained stable, naturally responsive, etc.
