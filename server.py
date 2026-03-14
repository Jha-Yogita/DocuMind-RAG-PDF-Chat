from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import worker
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

worker.init_llm()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload-pdf", methods=["POST"])
def upload_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(path)
    try:
        pages = worker.process_document(path)
        return jsonify({"status": "success", "pages": pages, "filename": file.filename})
    except Exception as e:
        logger.error(e)
        return jsonify({"error": str(e)}), 500


@app.route("/process-message", methods=["POST"])
def process_message():
    data = request.json or {}
    msg  = data.get("userMessage", "").strip()
    if not msg:
        return jsonify({"error": "Empty message"}), 400
    try:
        answer, sources = worker.process_prompt(msg)
        return jsonify({"botResponse": answer, "sources": sources})
    except Exception as e:
        logger.error(e)
        return jsonify({"error": str(e)}), 500


@app.route("/summary", methods=["POST"])
def summary():
    try:
        text = worker.generate_summary()
        return jsonify({"summary": text})
    except Exception as e:
        logger.error(e)
        return jsonify({"error": str(e)}), 500


@app.route("/flashcards", methods=["POST"])
def flashcards():
    count = request.json.get("count", 8) if request.json else 8
    try:
        cards = worker.generate_flashcards(count)
        return jsonify({"flashcards": cards})
    except Exception as e:
        logger.error(e)
        return jsonify({"error": str(e)}), 500


@app.route("/quiz", methods=["POST"])
def quiz():
    count = request.json.get("count", 5) if request.json else 5
    try:
        questions = worker.generate_quiz(count)
        return jsonify({"quiz": questions})
    except Exception as e:
        logger.error(e)
        return jsonify({"error": str(e)}), 500


@app.route("/key-terms", methods=["POST"])
def key_terms():
    try:
        terms = worker.generate_key_terms()
        return jsonify({"terms": terms})
    except Exception as e:
        logger.error(e)
        return jsonify({"error": str(e)}), 500


@app.route("/clear-history", methods=["POST"])
def clear_history():
    worker.clear_history()
    return jsonify({"status": "cleared"})


@app.route("/status")
def status():
    return jsonify({
        "llm_ready":       worker.llm_hub is not None,
        "document_loaded": worker.vectorstore is not None,
        "history_length":  len(worker.chat_history),
    })


if __name__ == "__main__":
    app.run(debug=False, port=8000, host="0.0.0.0")