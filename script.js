/* =========================
   KONFIGURASI GLOBAL
========================= */
const GOOGLE_SCRIPT_URL = window.GOOGLE_SCRIPT_URL;

let studentName = "", studentNIM = "", studentClass = "";
let questions = [], currentQuestions = [];
let answered = {};
let submitted = false;

let timeLeft = 0;
let timerInterval = null;

/* =========================
   LOAD & RENDER SOAL
========================= */
async function loadQuestions() {
  try {
    const r = await fetch('questions.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('questions.json tidak ditemukan');
    questions = await r.json();
  } catch (e) {
    alert('Soal ujian gagal dimuat. Hubungi admin.');
    console.error(e);
    throw e;
  }
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

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

function renderNav() {
  const nav = document.getElementById('question-numbers');
  nav.innerHTML = '';

  currentQuestions.forEach((_, i) => {
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

/* =========================
   TIMER
========================= */
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
  const el = document.getElementById('timer');
  if (el) el.textContent = `Waktu: ${m}:${s < 10 ? '0' + s : s}`;
}

/* =========================
   SUBMIT
========================= */
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

  try {
    localStorage.setItem('lastExamResult', JSON.stringify(payload));
  } catch (e) {}

  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    mode: 'no-cors'
  }).catch(() => {});

  document.getElementById('exam-page').style.display = 'none';
  document.getElementById('result-page').style.display = 'flex';
  document.getElementById('result-text').textContent =
    `Nama: ${studentName} | NIM: ${studentNIM} | Skor: ${score} / ${currentQuestions.length}`;

  history.replaceState(null, '', location.pathname + '#result');
  window.addEventListener('popstate', () => {
    history.replaceState(null, '', location.pathname + '#result');
  });
}

function autoSubmit(reason) {
  if (submitted) return;
  alert('Pelanggaran terdeteksi: ' + reason);
  collectAndSend(reason);
}

/* =========================
   ANTI CHEAT (AMAN)
========================= */
function setupAntiCheat() {
  const isMobile = window.innerWidth < 768;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) autoSubmit('pindah tab');
  });

  window.addEventListener('blur', () => {
    autoSubmit('kehilangan fokus');
  });

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) autoSubmit('keluar fullscreen');
  });

  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('selectstart', e => e.preventDefault());

  ['copy', 'paste', 'cut'].forEach(evt => {
    document.addEventListener(evt, e => {
      e.preventDefault();
      autoSubmit(evt + ' terdeteksi');
    });
  });

  window.addEventListener('keydown', e => {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I', 'J'].includes(e.key)) ||
      (e.ctrlKey && ['c', 'v', 'x'].includes(e.key.toLowerCase()))
    ) {
      e.preventDefault();
      autoSubmit('developer tools / copy');
    }
  });

  if (!isMobile) {
    let w = window.innerWidth, h = window.innerHeight;
    setInterval(() => {
      if (submitted) return;
      if (
        Math.abs(window.innerWidth - w) > 150 ||
        Math.abs(window.innerHeight - h) > 150
      ) {
        autoSubmit('resize window');
      }
      w = window.innerWidth;
      h = window.innerHeight;
    }, 1000);
  }
}

/* =========================
   FULLSCREEN (WAJIB USER GESTURE)
========================= */
function enterSecureMode() {
  try {
    document.documentElement.requestFullscreen();
  } catch (e) {}
}

/* =========================
   EVENT START
========================= */
document.getElementById('start-btn').addEventListener('click', () => {
  studentName = document.getElementById('student-name').value.trim();
  studentNIM = document.getElementById('student-nim').value.trim();
  studentClass = document.getElementById('student-class').value.trim();

  if (!studentName || !studentNIM || !studentClass) {
    alert('Isi Nama, NIM, dan Kelas.');
    return;
  }

  // 🔐 WAJIB langsung dari user gesture
  enterSecureMode();

  (async () => {
    await loadQuestions();
    currentQuestions = shuffle(questions.slice());

    renderQuestions();
    renderNav();
    setCurrent(0);

    document.getElementById('login-page').style.display = 'none';
    document.getElementById('exam-page').style.display = 'block';
    document.getElementById('info-student').textContent =
      `${studentName} • ${studentNIM} • ${studentClass}`;

    startTimer(currentQuestions.length * 70);
    setupAntiCheat();
  })();
});

/* =========================
   NAVIGASI
========================= */
document.getElementById('next-btn').onclick = () => {
  const idx = getCurrentVisible();
  setCurrent(Math.min(idx + 1, currentQuestions.length - 1));
};

document.getElementById('prev-btn').onclick = () => {
  const idx = getCurrentVisible();
  setCurrent(Math.max(idx - 1, 0));
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

document.getElementById('submit-btn').onclick = () => {
  if (confirm('Kirim jawaban sekarang?')) collectAndSend('manual');
};

window.addEventListener('beforeunload', e => {
  if (!submitted) {
    e.preventDefault();
    e.returnValue = '';
  }
});
