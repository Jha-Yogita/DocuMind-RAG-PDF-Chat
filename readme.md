# DocuMind

A local RAG (Retrieval-Augmented Generation) application that lets you chat with PDF documents, generate summaries, flashcards, quizzes, and extract key terms — powered by Groq's fast inference API and local embeddings.

---

## Features

- **Chat** — Ask any question about your uploaded PDF
- **Summary** — Auto-generated TL;DR with key topics and findings
- **Flashcards** — Study cards generated from document content
- **Quiz** — Multiple-choice questions with explanations and scoring
- **Key Terms** — Domain-specific vocabulary extracted and defined

---

## Requirements

- Python 3.11
- A free [Groq API key](https://console.groq.com)

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/yourname/documind.git
cd documind
```

### 2. Create a Python 3.11 virtual environment

```bash
# Linux / Mac
python3.11 -m venv rag_env
source rag_env/bin/activate

# Windows
py -3.11 -m venv rag_env
rag_env\Scripts\activate
```

### 3. Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and paste your Groq API key:

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

Get a free key at [console.groq.com](https://console.groq.com) → API Keys → Create Key.

### 5. Run the server

```bash
python server.py
```

Open your browser at **http://localhost:8000**

---

## Project Structure

```
SUMMARIZE-RAG/
├── server.py              # Flask app and API routes
├── worker.py              # LLM calls, RAG pipeline, document processing
├── requirements.txt       # Python dependencies
├── .env                   # Your secrets (never commit this)
├── .env.example           # Template for .env
├── .gitignore
├── templates/
│   └── index.html         # Frontend UI
├── static/
│   └── script.js          # Frontend JS
└── uploads/               # Uploaded PDFs (auto-created, gitignored)
```

---

## Changing the Model

Edit `GROQ_MODEL` in your `.env` file:

| Model | Speed | Quality | Best for |
|---|---|---|---|
| `llama-3.1-8b-instant` | ⚡ Fast | Good | Default, everyday use |
| `llama-3.3-70b-versatile` | Slower | Excellent | Complex documents |
| `mixtral-8x7b-32768` | Medium | Good | Long documents |

---

## Scanned PDFs

If your PDF is image-based (no selectable text), install OCR support and pre-process it:

```bash
pip install ocrmypdf
ocrmypdf your_file.pdf your_file_ocr.pdf
```

Then upload the `_ocr.pdf` version.

---

## Notes

- Uploaded PDFs are stored in `uploads/` and are gitignored
- Vector store is in-memory — reupload your PDF after restarting the server
- Groq free tier has rate limits; wait a moment if you hit them