# 📄 DocuMind

**DocuMind** is a local **Retrieval-Augmented Generation (RAG)** application that allows you to interact with PDF documents using natural language.

Upload a document and instantly **chat with it, generate summaries, flashcards, quizzes, and extract key terms**.

The system uses **local embeddings for retrieval** and **Groq's high-speed inference API** for text generation.

---

# ✨ Features

### 💬 Chat with your PDF
Ask questions about any uploaded document and receive answers grounded in the document content.

### 📑 Automatic Summary
Generate concise summaries highlighting key topics and findings.

### 🧠 Flashcards
Create study flashcards from important concepts extracted from the document.

### 📝 Quiz Generator
Generate **multiple-choice quizzes** with explanations and scoring.

### 🔑 Key Term Extraction
Automatically detect and define important domain-specific terms.

---

# 🏗 Architecture

DocuMind follows a **Retrieval-Augmented Generation (RAG)** pipeline:

1. PDF Upload
2. Text Extraction
3. Document Chunking
4. Embedding Generation (Local)
5. Vector Search
6. Context Retrieval
7. Response Generation via Groq LLM

This ensures responses remain **grounded in the document content instead of hallucinated answers**.

---

# ⚙️ Requirements

- Python **3.11**
- A **Groq API Key**
- Internet connection for Groq inference

---

# 🚀 Installation

## 1. Clone the repository

```bash
git clone https://github.com/yourname/documind.git
cd documind
```

---

## 2. Create a Python 3.11 virtual environment

### Linux / macOS

```bash
python3.11 -m venv rag_env
source rag_env/bin/activate
```

### Windows

```bash
py -3.11 -m venv rag_env
rag_env\Scripts\activate
```

---

## 3. Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 4. Set up environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` and paste your **Groq API key**:

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

You can get a free key at:

```
https://console.groq.com
```

Navigate to:

```
API Keys → Create Key
```

---

# ▶ Running the Application

Start the server:

```bash
python server.py
```

Open the application in your browser:

```
http://localhost:8000
```

---

# 📂 Project Structure

```
SUMMARIZE-RAG/

server.py              # Flask app and API routes
worker.py              # RAG pipeline and document processing
requirements.txt       # Python dependencies
.env                   # Environment variables (not committed)
.env.example           # Template environment file
.gitignore

templates/
   index.html          # Frontend interface

static/
   script.js           # Frontend logic

uploads/               # Uploaded PDFs (auto-created, gitignored)
```

---

# 🤖 Changing the Model

Edit the `.env` file to change the Groq model.

| Model | Speed | Quality | Best Use |
|------|------|------|------|
| llama-3.1-8b-instant | ⚡ Fast | Good | Default use |
| llama-3.3-70b-versatile | Slower | Excellent | Complex documents |
| mixtral-8x7b-32768 | Medium | Good | Long documents |

Example configuration:

```
GROQ_MODEL=llama-3.1-8b-instant
```

---

# 📄 Handling Scanned PDFs

If your PDF is **image-based (no selectable text)** you must use OCR.

Install OCR support:

```bash
pip install ocrmypdf
```

Convert the file:

```bash
ocrmypdf input.pdf output_ocr.pdf
```

Upload the `output_ocr.pdf` version.

---

# ⚠️ Notes

- Uploaded PDFs are stored in the **uploads/** folder and ignored by Git.
- The vector store runs **in memory**, so documents must be reuploaded after restarting the server.
- Groq free tier has **rate limits**, so brief delays may occur during heavy usage.

---

