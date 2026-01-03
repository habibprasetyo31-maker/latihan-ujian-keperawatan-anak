/* ================== CONFIG ================== */
const GOOGLE_SCRIPT_URL = window.GOOGLE_SCRIPT_URL;
/* ============================================ */

let studentName = "", studentNIM = "", studentClass = "";
let questions = [], currentQuestions = [], answered = {};
let submitted = false;
let timeLeft = 0, timerInterval = null;

/* ===== REVIEW MODE ===== */
let reviewMode = false;
let reviewData = null;
/* ======================= */

async function loadQuestions() {
  const r = await fetch('questions.json', { cache: 'no-store' });
  questions = await r.json();
}

function shuffle(a) {
  return a.sort(() => Math.random() - 0.5);
}

/* ================== RENDER ================== */
function renderQuestions() {
  const container = document.getElementById('questions');
  container.innerHTML = '';

  currentQuestions.forEach((q, i) => {
    const div = document.createElement('div');
    div.className = 'question';
    div.id = 'q-' + i;

    const opts = q.options.map(opt => `
      <label class="option" data-q="${i}">
        <input type="radio" name="q${i}" value="${opt}">
        <span class="opt-text">${opt}</span>
      </label>
    `).join('');

    div.innerHTML = `
      <p><strong>${i + 1}. ${q.text}</strong></p>
      <div class="options">${opts}</div>
    `;
    container.appendChild(div);
  });

  if (!reviewMode) {
    document.querySelectorAll('.option').forEach(lbl => {
      lbl.addEventListener('click', () => {
        const input = lbl.querySelector('input');
        input.checked = true;

        const qIdx = parseInt(lbl.dataset.q, 10);
        answered[currentQuestions[qIdx].id] = input.value;

        lbl.parentElement.querySelectorAll('.option')
          .forEach(o => o.classList.remove('selected'));
        lbl.classList.add('selected');

        const nav = document.querySelector(
          `.nav-circle .circle[data-index="${qIdx}"]`
        );
        if (nav) nav.classList.add('answered');
      });
    });
  }
}

function renderNav() {
  const nav = document.getElementById('question-numbers');
  nav.innerHTML = '';

  currentQuestions.forEach((q, i) => {
    const c = document.createElement('div');
    c.className = 'circle';
    c.textContent = i + 1;
    c.dataset.index = i;
    c.onclick = () => {
      document.getElementById('q-' + i)
        .scrollIntoView({ behavior: 'smooth', block: 'center' });
      setCurrent(i);
    };
    nav.appendChild(c);
  });
}

function setCurrent(idx) {
  document.querySelectorAll('.nav-circle .circle')
    .forEach(el => el.classList.remove('current'));
  const el = document.querySelector(
    `.nav-circle .circle[data-index="${idx}"]`
  );
  if (el) el.classList.add('current');
}
/* ============================================ */

/* ================== TIMER ================== */
function startTimer(seconds) {
  timeLeft = seconds;
  updateTimer();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimer();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      autoSubmit('Waktu habis');
    }
  }, 1000);
}

function updateTimer() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  document.getElementById('timer').textContent =
    `Waktu: ${m}:${s < 10 ? '0' + s : s}`;
}
/* ============================================ */

/* ================== SUBMIT ================== */
function collectAndSend(reason = 'manual') {
  if (submitted) return;
  submitted = true;
  clearInterval(timerInterval);

  const answers = {};
  currentQuestions.forEach((q, i) => {
    const sel = document.querySelector(`input[name=q${i}]:checked`);
    answers[q.id] = sel ? sel.value : '';
  });

  let score = 0;
  currentQuestions.forEach(q => {
    if (answers[q.id] === q.correct) score++;
  });

  const payload = {
    name: studentName,
    nim: studentNIM,
    class: studentClass,
    score,
    detail: answers,
    reason,
    timestamp: new Date().toISOString()
  };

  localStorage.setItem('lastExamResult', JSON.stringify(payload));

  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    mode: 'no-cors'
  }).catch(() => {});

  document.getElementById('exam-page').style.display = 'none';
  document.getElementById('result-page').style.display = 'flex';
  document.getElementById('result-text').textContent =
    `Nama: ${studentName} | NIM: ${studentNIM} | Skor: ${score} / ${currentQuestions.length}`;

  const btn = document.createElement('button');
  btn.textContent = 'Review Jawaban';
  btn.className = 'primary';
  btn.onclick = enterReviewMode;
  document.querySelector('.result-card').appendChild(btn);
}
/* ============================================ */

/* ================== REVIEW ================== */
function enterReviewMode() {
  const saved = localStorage.getItem('lastExamResult');
  if (!saved) return alert('Data review tidak ditemukan');

  reviewMode = true;
  reviewData = JSON.parse(saved);

  studentName = reviewData.name;
  studentNIM = reviewData.nim;
  studentClass = reviewData.class;

  loadQuestions().then(() => {
    currentQuestions = questions.slice();
    renderQuestions();
    renderNav();
    setCurrent(0);

    currentQuestions.forEach((q, i) => {
      const userAns = reviewData.detail[q.id];
      document.querySelectorAll(`#q-${i} .option`).forEach(opt => {
        const input = opt.querySelector('input');
        input.disabled = true;

        if (input.value === q.correct) opt.classList.add('correct');
        if (input.value === userAns && userAns !== q.correct)
          opt.classList.add('wrong');

        if (input.value === userAns) {
          input.checked = true;
          opt.classList.add('selected');
        }
      });
    });

    document.getElementById('result-page').style.display = 'none';
    document.getElementById('exam-page').style.display = 'block';
    document.getElementById('submit-btn').style.display = 'none';
    document.getElementById('timer').textContent = 'Mode Review';

    document.getElementById('info-student').textContent =
      `${studentName} • NIM: ${studentNIM} • Kelas: ${studentClass} (REVIEW)`;
  });
}
/* ============================================ */

function autoSubmit(reason) {
  if (submitted) return;
  alert('Ujian dikirim otomatis: ' + reason);
  collectAndSend(reason);
}

/* ================== EVENTS ================== */
document.getElementById('start-btn').addEventListener('click', async () => {
  studentName = document.getElementById('student-name').value.trim();
  studentNIM = document.getElementById('student-nim').value.trim();
  studentClass = document.getElementById('student-class').value.trim();

  if (!studentName || !studentNIM || !studentClass) {
    alert('Isi Nama, NIM, dan Kelas.');
    return;
  }

  await loadQuestions();
  currentQuestions = shuffle(questions.slice());

  renderQuestions();
  renderNav();
  setCurrent(0);

  document.getElementById('login-page').style.display = 'none';
  document.getElementById('exam-page').style.display = 'block';
  document.getElementById('info-student').textContent =
    `${studentName} • NIM: ${studentNIM} • Kelas: ${studentClass}`;

  startTimer(currentQuestions.length * 70);
});

document.getElementById('submit-btn').onclick = () => {
  if (confirm('Kirim jawaban sekarang?')) collectAndSend('manual');
};

document.getElementById('next-btn').onclick = () => {
  setCurrent(Math.min(getCurrentVisible() + 1, currentQuestions.length - 1));
};

document.getElementById('prev-btn').onclick = () => {
  setCurrent(Math.max(getCurrentVisible() - 1, 0));
};

function getCurrentVisible() {
  const qs = document.querySelectorAll('.question');
  let best = 0, bestDiff = Infinity;
  const mid = window.innerHeight / 2;
  qs.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const diff = Math.abs((r.top + r.bottom) / 2 - mid);
    if (diff < bestDiff) {
      best = i;
      bestDiff = diff;
    }
  });
  return best;
}
