const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyxqwYcNIqVAjV_KSRO6QiIXMJ2dYdvLehVPAOmAaWKg5l8KhZinhGdrrv1sZEs5ZbZ/exec";
let studentName = "", studentNIM = "", studentClass = "";
let questions = [], currentQuestions = [], answered = {}, submitted = false;
let timeLeft = 0, timerInterval = null;

async function loadQuestions() {
  const r = await fetch('questions.json', {cache:'no-store'});
  questions = await r.json();
}

function shuffle(a) { return a.sort(() => Math.random() - 0.5); }

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
    div.innerHTML = `<p><strong>${i+1}. ${q.text}</strong></p><div class="options">${opts}</div>`;
    container.appendChild(div);
  });

  document.querySelectorAll('.option').forEach(lbl => {
    lbl.addEventListener('click', () => {
      const input = lbl.querySelector('input');
      input.checked = true;
      const qIdx = parseInt(lbl.dataset.q, 10);
      answered[currentQuestions[qIdx].id] = input.value;
      lbl.parentElement.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
      lbl.classList.add('selected');
      const nav = document.querySelector('.nav-circle .circle[data-index="'+qIdx+'"]');
      if (nav) nav.classList.add('answered');
    });
  });
}

function renderNav() {
  const nav = document.getElementById('question-numbers');
  nav.innerHTML = '';
  currentQuestions.forEach((q,i) => {
    const c = document.createElement('div');
    c.className = 'circle';
    c.textContent = i+1;
    c.dataset.index = i;
    c.onclick = () => {
      document.getElementById('q-' + i).scrollIntoView({behavior:'smooth', block:'center'});
      setCurrent(i);
    };
    nav.appendChild(c);
  });
}

function setCurrent(idx) {
  document.querySelectorAll('.nav-circle .circle').forEach(el => el.classList.remove('current'));
  const el = document.querySelector('.nav-circle .circle[data-index="'+idx+'"]');
  if (el) el.classList.add('current');
}

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
  const m = Math.floor(timeLeft/60);
  const s = timeLeft % 60;
  const el = document.getElementById('timer');
  if (el) el.textContent = `Waktu: ${m}:${s < 10 ? '0'+s : s}`;
}

function collectAndSend(reason='manual') {
  if (submitted) return;
  submitted = true;
  clearInterval(timerInterval);
  const answers = {};
  currentQuestions.forEach((q,i) => {
    const sel = document.querySelector(`input[name=q${i}]:checked`);
    answers[q.id] = sel ? sel.value : '';
  });
  let score = 0;
  currentQuestions.forEach(q => { if (answers[q.id] === q.correct) score++; });
  const payload = { name: studentName, nim: studentNIM, class: studentClass, score, detail: answers, reason, timestamp: new Date().toISOString() };
  try { localStorage.setItem('lastExamResult', JSON.stringify(payload)); } catch(e){ }
  fetch(GOOGLE_SCRIPT_URL, { method:'POST', body: JSON.stringify(payload), mode:'no-cors' }).catch(()=>{});
  document.getElementById('exam-page').style.display = 'none';
  document.getElementById('result-page').style.display = 'flex';
  document.getElementById('result-text').textContent = `Nama: ${studentName} | NIM: ${studentNIM} | Skor: ${score} / ${currentQuestions.length} (terkirim: ${reason})`;
  history.replaceState(null, '', location.pathname + '#result');
  window.addEventListener('popstate', () => { history.replaceState(null, '', location.pathname + '#result'); });
}

function autoSubmit(reason) {
  if (submitted) return;
  try { navigator.vibrate && navigator.vibrate(150); } catch(e){}
  alert('Deteksi tindakan terlarang: ' + reason + '. Ujian akan dikirim otomatis.');
  collectAndSend(reason);
}

function setupAntiCheat() {
  const mobile = /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(navigator.userAgent);
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoSubmit('berpindah aplikasi / tab'); });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) autoSubmit('keluar fullscreen'); });
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('selectstart', e => e.preventDefault());
  ['copy','paste','cut'].forEach(evt => {
    document.addEventListener(evt, e => {
      e.preventDefault();
      if (!mobile) autoSubmit(evt + ' terdeteksi');
    });
  });
  window.addEventListener('keydown', (e) => {
    if (mobile) return;
    if ((e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) || e.key === 'F12') { e.preventDefault(); autoSubmit('developer tools'); }
    if (e.ctrlKey && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'v')) { e.preventDefault(); autoSubmit('copy/paste terdeteksi'); }
    if (e.key === 'PrintScreen') { e.preventDefault(); autoSubmit('screenshot'); }
  });
  if (!mobile) {
    let lastW = window.innerWidth, lastH = window.innerHeight;
    setInterval(() => {
      if (submitted) return;
      const dx = Math.abs(window.innerWidth - lastW);
      const dy = Math.abs(window.innerHeight - lastH);
      if (dx > 200 || dy > 200) autoSubmit('perubahan ukuran terdeteksi');
      lastW = window.innerWidth; lastH = window.innerHeight;
    }, 1200);
  } else {
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { alert('Perubahan orientasi terdeteksi. Tetap gunakan portrait untuk mengikuti ujian.'); }, 400);
    });
    document.addEventListener('touchstart', function(e){ });
  }
}

async function enterSecureMode() {
  try { if (screen.orientation && screen.orientation.lock) { await screen.orientation.lock('portrait'); } } catch(e){}
  try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else if (document.documentElement.webkitRequestFullscreen) await document.documentElement.webkitRequestFullscreen(); } catch(e){ console.warn('fullscreen failed', e); }
}

document.getElementById('start-btn').addEventListener('click', async () => {
  studentName = document.getElementById('student-name').value.trim();
  studentNIM = document.getElementById('student-nim').value.trim();
  studentClass = document.getElementById('student-class').value.trim();
  if (!studentName || !studentNIM || !studentClass) { alert('Isi Nama, NIM, dan Kelas.'); return; }
  await loadQuestions();
  currentQuestions = shuffle(questions.slice());
  renderQuestions(); renderNav(); setCurrent(0);
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('exam-page').style.display = 'block';
  document.getElementById('info-student').textContent = `${studentName} • NIM: ${studentNIM} • Kelas: ${studentClass}`;
  startTimer(currentQuestions.length * 70);
  setupAntiCheat();
  await enterSecureMode();
  history.pushState(null, '', location.pathname + '#exam');
  window.addEventListener('popstate', () => { history.pushState(null, '', location.pathname + '#exam'); });
});

document.getElementById('next-btn').addEventListener('click', () => {
  const idx = getCurrentVisible();
  const next = Math.min(idx + 1, currentQuestions.length - 1);
  document.getElementById('q-'+next).scrollIntoView({behavior:'smooth', block:'center'});
  setCurrent(next);
});
document.getElementById('prev-btn').addEventListener('click', () => {
  const idx = getCurrentVisible();
  const prev = Math.max(idx - 1, 0);
  document.getElementById('q-'+prev).scrollIntoView({behavior:'smooth', block:'center'});
  setCurrent(prev);
});
function getCurrentVisible() {
  const qs = document.querySelectorAll('.question');
  let best = 0, bestDiff = Infinity, mid = window.innerHeight/2;
  qs.forEach((el,i) => {
    const r = el.getBoundingClientRect();
    const diff = Math.abs((r.top + r.bottom)/2 - mid);
    if (diff < bestDiff) { best = i; bestDiff = diff; }
  });
  return best;
}
document.getElementById('submit-btn').addEventListener('click', () => {
  if (confirm('Kirim jawaban sekarang?')) collectAndSend('manual');
});
window.addEventListener('beforeunload', (e) => { if (!submitted) { e.preventDefault(); e.returnValue=''; } });
