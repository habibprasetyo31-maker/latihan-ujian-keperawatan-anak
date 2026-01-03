const GOOGLE_SCRIPT_URL = window.GOOGLE_SCRIPT_URL;

let studentName = "", studentNIM = "", studentClass = "";
let questions = [], currentQuestions = [];
let submitted = false;
let timeLeft = 0, timerInterval = null;

let reviewMode = false;
let reviewData = null;

/* ================= DOM READY ================= */
document.addEventListener('DOMContentLoaded', () => {

  const startBtn = document.getElementById('start-btn');
  const submitBtn = document.getElementById('submit-btn');
  const nextBtn = document.getElementById('next-btn');
  const prevBtn = document.getElementById('prev-btn');

  /* ===== LOAD QUESTIONS ===== */
  async function loadQuestions() {
    const r = await fetch('questions.json', { cache: 'no-store' });
    questions = await r.json();
  }

  function shuffle(a) {
    return a.sort(() => Math.random() - 0.5);
  }

  /* ===== RENDER QUESTIONS ===== */
  function renderQuestions() {
    const container = document.getElementById('questions');
    container.innerHTML = '';

    currentQuestions.forEach((q, i) => {
      const div = document.createElement('div');
      div.className = 'question';
      div.id = 'q-' + i;

      const opts = q.options.map(opt => `
        <label class="option">
          <input type="radio" name="q${i}" value="${opt}">
          <span class="opt-text">${opt}</span>
        </label>
      `).join('');

      div.innerHTML = `<p><strong>${i + 1}. ${q.text}</strong></p><div class="options">${opts}</div>`;
      container.appendChild(div);
    });

    if (!reviewMode) {
      document.querySelectorAll('.option').forEach((opt, idx) => {
        opt.addEventListener('click', () => {
          const input = opt.querySelector('input');
          input.checked = true;
        });
      });
    }
  }

  /* ===== TIMER ===== */
  function startTimer(seconds) {
    timeLeft = seconds;
    timerInterval = setInterval(() => {
      timeLeft--;
      document.getElementById('timer').textContent =
        `Waktu: ${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        collectAndSend('Waktu habis');
      }
    }, 1000);
  }

  /* ===== SUBMIT ===== */
  function collectAndSend(reason) {
    if (submitted) return;
    submitted = true;
    clearInterval(timerInterval);

    const answers = {};
    let score = 0;

    currentQuestions.forEach((q, i) => {
      const sel = document.querySelector(`input[name=q${i}]:checked`);
      answers[q.id] = sel ? sel.value : '';
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
      `Nama: ${studentName} | NIM: ${studentNIM} | Skor: ${score}/${currentQuestions.length}`;

    const reviewBtn = document.createElement('button');
    reviewBtn.className = 'primary';
    reviewBtn.textContent = 'Review Jawaban';
    reviewBtn.onclick = enterReviewMode;
    document.querySelector('.result-card').appendChild(reviewBtn);
  }

  /* ===== REVIEW MODE ===== */
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

      currentQuestions.forEach((q, i) => {
        document.querySelectorAll(`#q-${i} .option`).forEach(opt => {
          const input = opt.querySelector('input');
          input.disabled = true;

          if (input.value === q.correct) opt.classList.add('correct');
          if (input.value === reviewData.detail[q.id] && input.value !== q.correct)
            opt.classList.add('wrong');

          if (input.value === reviewData.detail[q.id]) input.checked = true;
        });
      });

      document.getElementById('result-page').style.display = 'none';
      document.getElementById('exam-page').style.display = 'block';
      document.getElementById('submit-btn').style.display = 'none';
      document.getElementById('timer').textContent = 'Mode Review';
    });
  }

  /* ===== EVENTS ===== */
  startBtn.addEventListener('click', async () => {
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

    document.getElementById('login-page').style.display = 'none';
    document.getElementById('exam-page').style.display = 'block';
    document.getElementById('info-student').textContent =
      `${studentName} • NIM: ${studentNIM} • Kelas: ${studentClass}`;

    startTimer(currentQuestions.length * 70);
  });

  submitBtn.addEventListener('click', () => {
    if (confirm('Kirim jawaban sekarang?')) collectAndSend('manual');
  });

});
