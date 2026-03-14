import os
import json
import re
import logging
import groq as groq_lib
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter

os.environ["ANONYMIZED_TELEMETRY"] = "False"

logger = logging.getLogger(__name__)

DEVICE       = "cpu"

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
embeddings                   = None
vectorstore                  = None
conversation_retrieval_chain = True   
llm_hub                      = True   
chat_history                 = []


def init_llm():
    global embeddings
    logger.info("Loading embedding model…")
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": DEVICE},
    )
    logger.info("Embeddings ready. Groq will be called at query time.")


# ── GROQ ────────────────────────────────────────────────────────
def _ollama(prompt: str, system: str = "") -> str:
    """Named _ollama for drop-in compatibility but now calls Groq API."""
    try:
        client = groq_lib.Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system or "You are a helpful assistant."},
                {"role": "user",   "content": prompt}
            ],
            max_tokens=1024,
            temperature=0.2,
        )
        return response.choices[0].message.content.strip()
    except groq_lib.AuthenticationError:
        raise RuntimeError("Invalid Groq API key. Check GROQ_API_KEY in worker.py.")
    except groq_lib.RateLimitError:
        raise RuntimeError("Groq rate limit hit. Wait a moment and try again.")
    except Exception as e:
        raise RuntimeError(f"Groq error: {e}")


def _parse_json(raw: str) -> list:
    """Robustly extract a JSON array, handling fences and common LLM formatting issues."""
    raw = re.sub(r'```(?:json)?', '', raw).strip()
    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass
    match = re.search(r'\[.*\]', raw, re.DOTALL)
    if match:
        chunk = match.group()
        try:
            return json.loads(chunk)
        except json.JSONDecodeError:
            pass
        chunk = re.sub(r',\s*([}\]])', r'\1', chunk)
        chunk = chunk.replace('\u201c', '"').replace('\u201d', '"')
        chunk = chunk.replace('\u2018', "'").replace('\u2019', "'")
        chunk = re.sub(r'[\x00-\x1f\x7f]', ' ', chunk)
        try:
            return json.loads(chunk)
        except json.JSONDecodeError:
            pass
    objects = re.findall(r'\{[^{}]+\}', raw, re.DOTALL)
    if objects:
        results = []
        for obj in objects:
            try:
                results.append(json.loads(obj))
            except json.JSONDecodeError:
                obj = re.sub(r',\s*([}])', r'\1', obj)
                obj = re.sub(r'[\x00-\x1f\x7f]', ' ', obj)
                try:
                    results.append(json.loads(obj))
                except json.JSONDecodeError:
                    continue
        if results:
            return results
    raise ValueError("Could not parse JSON from model response.")


def process_document(document_path: str) -> int:
    global vectorstore

    loader     = PyPDFLoader(document_path)
    documents  = loader.load()
    page_count = len(documents)

    if page_count == 0:
        raise RuntimeError("PDF appears to be empty or could not be read.")

    docs_with_text = [d for d in documents if d.page_content and d.page_content.strip()]

    if not docs_with_text:
        raise RuntimeError(
            "No text could be extracted from this PDF. "
            "It may be a scanned image-based PDF. "
            "Try running it through OCR first (e.g. ocrmypdf)."
        )

    logger.info(f"Loaded {page_count} pages, {len(docs_with_text)} had extractable text.")

    splitter = RecursiveCharacterTextSplitter(chunk_size=1024, chunk_overlap=128)
    texts    = splitter.split_documents(docs_with_text)
    texts    = [t for t in texts if t.page_content and t.page_content.strip()]

    if not texts:
        raise RuntimeError("Text was found but all chunks were empty after splitting.")

    vectorstore = Chroma.from_documents(texts, embedding=embeddings)
    logger.info(f"Indexed {page_count} pages → {len(texts)} chunks.")
    return page_count


def _retrieve(query: str, k: int = 4):
    if vectorstore is None:
        return "", []
    docs  = vectorstore.similarity_search(query, k=k)
    ctx   = "\n\n---\n\n".join(d.page_content for d in docs)
    pages = []
    for d in docs:
        p = d.metadata.get("page")
        if p is not None and (p + 1) not in pages:
            pages.append(p + 1)
    return ctx, pages


def process_prompt(prompt: str):
    if vectorstore is None:
        return "Please upload a PDF document first.", []

    ctx, pages = _retrieve(prompt)
    hist = "\n".join(f"User: {q}\nAssistant: {a}" for q, a in chat_history[-3:])

    system = (
        "You are a helpful document assistant. Answer ONLY from the provided "
        "document context. If the answer is not in the context, say so honestly. "
        "Be concise but thorough."
    )
    full_prompt = (
        f"Document context:\n{ctx}\n\n"
        + (f"Conversation so far:\n{hist}\n\n" if hist else "")
        + f"Question: {prompt}\n\nAnswer:"
    )
    answer = _ollama(full_prompt, system=system)
    chat_history.append((prompt, answer))
    return answer, pages



def generate_summary() -> str:
    if vectorstore is None:
        raise RuntimeError("No document loaded.")
    docs = vectorstore.similarity_search(
        "main topic overview introduction conclusion", k=6)
    ctx  = "\n\n".join(d.page_content for d in docs)

    return _ollama(
        f"Document excerpts:\n{ctx}\n\n"
        "Write a well-structured summary with:\n"
        "1. One-sentence TL;DR\n"
        "2. Key topics (bullet points)\n"
        "3. Main findings or arguments\n"
        "4. Important conclusions",
        system="You are an expert summariser. Be structured and insightful.",
    )


def generate_flashcards(count: int = 8) -> list:
    if vectorstore is None:
        raise RuntimeError("No document loaded.")
    docs = vectorstore.similarity_search(
        "key concepts definitions important facts", k=6)
    ctx  = "\n\n".join(d.page_content for d in docs)

    raw = _ollama(
        f"Document content:\n{ctx}\n\n"
        f"Create exactly {count} flashcards.\n"
        "Return ONLY a JSON array, no markdown, no explanation:\n"
        '[{"front": "question or term", "back": "answer or definition"}, ...]',
        system="You are an expert educator who creates effective study flashcards.",
    )
    return _parse_json(raw)[:count]


def generate_quiz(count: int = 5) -> list:
    if vectorstore is None:
        raise RuntimeError("No document loaded.")
    docs = vectorstore.similarity_search(
        "facts details specific information", k=6)
    ctx  = "\n\n".join(d.page_content for d in docs)

    raw = _ollama(
        f"Document content:\n{ctx}\n\n"
        f"Create exactly {count} multiple-choice questions.\n"
        "Return ONLY a JSON array, no markdown:\n"
        '[{"question":"...","options":["A","B","C","D"],"answer":"A","explanation":"..."}, ...]\n'
        "The 'answer' field must be exactly the correct option text.",
        system="You are an expert at writing multiple-choice quiz questions.",
    )
    return _parse_json(raw)[:count]


def generate_key_terms() -> list:
    if vectorstore is None:
        raise RuntimeError("No document loaded.")
    docs = vectorstore.similarity_search(
        "terminology glossary definitions concepts", k=6)
    ctx  = "\n\n".join(d.page_content for d in docs)

    raw = _ollama(
        f"Document content:\n{ctx}\n\n"
        "Extract 10 key terms or concepts.\n"
        "Return ONLY a JSON array:\n"
        '[{"term": "...", "definition": "..."}, ...]',
        system="You are an expert at identifying domain-specific terminology.",
    )
    return _parse_json(raw)[:10]


def clear_history():
    global chat_history
    chat_history = []