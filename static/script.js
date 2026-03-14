
let selectedFile = null;
let isTyping     = false;
let quizAnswers  = {};   
let quizData     = [];


function switchTab(name, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  btn.classList.add('active');
}

const fileInput = document.getElementById('file-upload');
const uploadBtn = document.getElementById('upload-btn');
const dropZone  = document.getElementById('drop-zone');

fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files[0] || null;
  uploadBtn.disabled = !selectedFile;
  if (selectedFile) updateDropLabel(selectedFile);
});

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f && f.type === 'application/pdf') {
    selectedFile = f;
    uploadBtn.disabled = false;
    updateDropLabel(f);
  } else {
    toast('Only PDF files are supported', 'error');
  }
});

function updateDropLabel(f) {
  dropZone.querySelector('.drop-label').innerHTML =
    `<strong>${esc(f.name)}</strong>${fmtBytes(f.size)}`;
}

async function uploadFile() {
  if (!selectedFile) return;
  uploadBtn.disabled    = true;
  uploadBtn.textContent = 'Processing…';
  progress(true);

  const fd = new FormData();
  fd.append('file', selectedFile);

  try {
    const r    = await fetch('/upload-pdf', { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || 'Upload failed');

    document.getElementById('doc-card').classList.add('visible');
    document.getElementById('doc-name').textContent  = data.filename;
    document.getElementById('doc-pages').textContent = `${data.pages} pages`;
    toast(`"${data.filename}" indexed (${data.pages} pages)`, 'success');
  } catch (e) {
    toast(e.message, 'error');
    uploadBtn.disabled = false;
  } finally {
    uploadBtn.textContent = 'Process →';
    progress(false);
  }
}

async function sendMessage() {
  const inp = document.getElementById('message-input');
  const msg = inp.value.trim();
  if (!msg || isTyping) return;

  const empty = document.getElementById('empty-state');
  if (empty) empty.remove();

  addMsg('user', msg);
  inp.value = '';
  autoResize(inp);

  const tid = addTyping();
  isTyping = true;
  document.getElementById('send-btn').disabled = true;

  try {
    const r    = await fetch('/process-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage: msg }),
    });
    const data = await r.json();
    removeTyping(tid);
    if (!r.ok || data.error) addMsg('bot', data.error || 'Something went wrong.', []);
    else addMsg('bot', data.botResponse, data.sources || []);
  } catch {
    removeTyping(tid);
    addMsg('bot', 'Network error — is the server running?', []);
  } finally {
    isTyping = false;
    document.getElementById('send-btn').disabled = false;
  }
}

function addMsg(role, text, sources = []) {
  const chat = document.getElementById('chat');
  const w    = document.createElement('div');
  w.className = `msg ${role}`;

  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = role === 'user' ? 'You' : 'DocuMind';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  w.appendChild(label);
  w.appendChild(bubble);

  if (sources.length) {
    const s = document.createElement('div');
    s.className = 'msg-sources';
    s.textContent = `📄 Page${sources.length > 1 ? 's' : ''}: ${sources.join(', ')}`;
    w.appendChild(s);
  }

  chat.appendChild(w);
  chat.scrollTop = chat.scrollHeight;
}

function addTyping() {
  const chat = document.getElementById('chat');
  const id   = 'typing-' + Date.now();
  const w    = document.createElement('div');
  w.className = 'typing-wrap';
  w.id = id;
  w.innerHTML = '<div class="typing-label">DocuMind</div><div class="typing-bubble"><div class="tdot"></div><div class="tdot"></div><div class="tdot"></div></div>';
  chat.appendChild(w);
  chat.scrollTop = chat.scrollHeight;
  return id;
}

function removeTyping(id) { document.getElementById(id)?.remove(); }

function setMsg(t) {
  const inp = document.getElementById('message-input');
  inp.value = t;
  inp.focus();
  autoResize(inp);
}

async function clearHistory() {
  await fetch('/clear-history', { method: 'POST' });
  const chat = document.getElementById('chat');
  chat.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.id = 'empty-state';
  empty.style.opacity = '1';
  empty.innerHTML = `
    <div class="empty-accent">↺</div>
    <div class="empty-title">Cleared</div>
    <div class="empty-sub">History wiped. Start a new conversation.</div>`;
  chat.appendChild(empty);
  toast('Conversation cleared', 'success');
}

async function loadSummary() {
  const el  = document.getElementById('summary-content');
  const btn = document.getElementById('btn-summary');
  el.innerHTML  = loadingHtml('Generating summary…');
  btn.disabled  = true;

  try {
    const r    = await fetch('/summary', { method: 'POST' });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error);
    el.innerHTML = `<div class="summary-body">${esc(data.summary)}</div>`;
  } catch (e) {
    el.innerHTML = errHtml(e.message);
  } finally {
    btn.disabled = false;
  }
}

async function loadFlashcards() {
  const el    = document.getElementById('cards-content');
  const btn   = document.getElementById('btn-cards');
  const count = parseInt(document.getElementById('card-count').value) || 8;
  el.innerHTML = loadingHtml('Generating flashcards…');
  btn.disabled = true;

  try {
    const r    = await fetch('/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error);

    const grid = document.createElement('div');
    grid.className = 'cards-grid';

    data.flashcards.forEach((c, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.id = `card-${i}`;
      card.innerHTML = `
        <div class="card-inner">
          <div class="card-face card-front">
            <div class="card-tag">Question</div>
            <div class="card-text">${esc(c.front)}</div>
            <div class="card-hint">click to reveal →</div>
          </div>
          <div class="card-face card-back">
            <div class="card-tag">Answer</div>
            <div class="card-text">${esc(c.back)}</div>
          </div>
        </div>`;
      card.addEventListener('click', () => card.classList.toggle('flipped'));
      grid.appendChild(card);
    });

    el.innerHTML = `<div class="cards-controls">
      <span>${data.flashcards.length} cards · Click to flip</span>
      <button class="chip" onclick="resetCards()" style="margin-left:auto">Reset all</button>
    </div>`;
    el.appendChild(grid);
  } catch (e) {
    el.innerHTML = errHtml(e.message);
  } finally {
    btn.disabled = false;
  }
}

function resetCards() {
  document.querySelectorAll('.card.flipped').forEach(c => c.classList.remove('flipped'));
}

async function loadQuiz() {
  const el    = document.getElementById('quiz-content');
  const btn   = document.getElementById('btn-quiz');
  const count = parseInt(document.getElementById('quiz-count').value) || 5;
  el.innerHTML = loadingHtml('Generating quiz…');
  btn.disabled = true;
  quizAnswers  = {};
  quizData     = [];

  try {
    const r    = await fetch('/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error);

    quizData = data.quiz;
    renderQuiz(quizData);
  } catch (e) {
    el.innerHTML = errHtml(e.message);
  } finally {
    btn.disabled = false;
  }
}

function renderQuiz(questions) {
  const el   = document.getElementById('quiz-content');
  const wrap = document.createElement('div');
  wrap.className = 'quiz-wrap';

  questions.forEach((q, qi) => {
    const card = document.createElement('div');
    card.className = 'q-card';
    card.id = `q-${qi}`;

    const opts = (q.options || []).map(opt => `
      <button class="q-opt" onclick="answerQuiz(${qi}, \`${esc(opt)}\`, this)">
        ${esc(opt)}
      </button>`).join('');

    card.innerHTML = `
      <div class="q-head"><span class="q-num">Q${qi + 1}</span><span>Multiple choice</span></div>
      <div class="q-text">${esc(q.question)}</div>
      <div class="q-options">${opts}</div>
      <div class="q-explanation" id="exp-${qi}">${esc(q.explanation || '')}</div>`;
    wrap.appendChild(card);
  });

  
  const score = document.createElement('div');
  score.className = 'quiz-score';
  score.id = 'quiz-score';
  score.style.display = 'none';
  wrap.appendChild(score);

  el.innerHTML = '';
  el.appendChild(wrap);
}

function answerQuiz(qi, chosen, btn) {
  if (quizAnswers[qi] !== undefined) return;   
  quizAnswers[qi] = chosen;

  const q       = quizData[qi];
  const correct = q.answer;
  const card    = document.getElementById(`q-${qi}`);

  card.querySelectorAll('.q-opt').forEach(b => {
    b.classList.add('answered');
    if (b.textContent.trim() === correct) b.classList.add('correct');
    else if (b === btn && chosen !== correct) b.classList.add('wrong');
  });

  const exp = document.getElementById(`exp-${qi}`);
  if (exp) exp.classList.add('show');

  
  if (Object.keys(quizAnswers).length === quizData.length) showScore();
}

function showScore() {
  const correct = quizData.filter((q, i) => quizAnswers[i] === q.answer).length;
  const total   = quizData.length;
  const pct     = Math.round((correct / total) * 100);
  const score   = document.getElementById('quiz-score');
  score.style.display = 'block';
  score.innerHTML = `
    <div class="quiz-score-num">${correct}/${total}</div>
    <div class="quiz-score-label">${pct}% correct · ${
      pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good work.' : 'Keep studying.'
    }</div>`;
  score.scrollIntoView({ behavior: 'smooth' });
}

async function loadTerms() {
  const el  = document.getElementById('terms-content');
  const btn = document.getElementById('btn-terms');
  el.innerHTML = loadingHtml('Extracting key terms…');
  btn.disabled = true;

  try {
    const r    = await fetch('/key-terms', { method: 'POST' });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error);

    const grid = document.createElement('div');
    grid.className = 'terms-grid';

    data.terms.forEach(t => {
      const card = document.createElement('div');
      card.className = 'term-card';
      card.innerHTML = `<div class="term-name">${esc(t.term)}</div>
        <div class="term-def">${esc(t.definition)}</div>`;
      grid.appendChild(card);
    });

    el.innerHTML = '';
    el.appendChild(grid);
  } catch (e) {
    el.innerHTML = errHtml(e.message);
  } finally {
    btn.disabled = false;
  }
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  const n = el.value.length;
  document.getElementById('char-count').textContent = n ? `${n} chars` : '';
}

function progress(on) {
  const bar  = document.getElementById('progress-bar');
  const fill = document.getElementById('progress-fill');
  if (on) {
    bar.classList.add('active');
    fill.style.width = '0%';
    let w = 0;
    const iv = setInterval(() => { w = Math.min(w + Math.random() * 14, 88); fill.style.width = w + '%'; if (w >= 88) clearInterval(iv); }, 250);
    bar._iv = iv;
  } else {
    clearInterval(bar._iv);
    fill.style.width = '100%';
    setTimeout(() => bar.classList.remove('active'), 400);
  }
}

function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3500);
}

function esc(str = '') {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function fmtBytes(b) {
  if (b < 1024)        return ` · ${b} B`;
  if (b < 1024 * 1024) return ` · ${(b / 1024).toFixed(1)} KB`;
  return ` · ${(b / 1024 / 1024).toFixed(1)} MB`;
}

function loadingHtml(msg = 'Loading…') {
  return `<div class="loading-msg"><div class="spin"></div><br>${msg}</div>`;
}

function errHtml(msg) {
  return `<div class="loading-msg" style="color:var(--red)">⚠ ${esc(msg)}</div>`;
}