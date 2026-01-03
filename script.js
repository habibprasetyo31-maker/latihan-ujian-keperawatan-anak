/***********************
 * KONFIGURASI
 ***********************/
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxqwYcNIqVAjV_KSRO6QiIXMJ2dYdvLehVPAOmAaWKg5l8KhZinhGdrrv1sZEs5ZbZ/exec";

/***********************
 * VARIABEL GLOBAL
 ***********************/
let studentName = "",
  studentNIM = "",
  studentClass = "";

let questions = [],
  currentQuestions = [],
  answered = {};

let submitted = false;
let timeLeft = 0;
let timerInterval = null;

/***********************
 * LOAD & RENDER SOAL
 ***********************/
async function loadQuestions() {
  const r = await fetch("questions.json", { cache: "no-store" });
  questions = await r.json();
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

function renderQuestions() {
  const container = document.getElementById("questions");
  container.innerHTML = "";

  currentQuestions.forEach((q, i) => {
    const div = document.createElement("div");
    div.className = "question";
    div.id = "q-" + i;

    const opts = q.options
      .map(
        (opt) => `
      <label class="option" data-q="${i}">
        <input type="radio" name="q${i}" value="${opt}">
        <span>${opt}</span>
      </label>`
      )
      .join("");

    div.innerHTML = `
      <p><strong>${i + 1}. ${q.text}</strong></p>
      <div class="options">${opts}</div>
    `;
    container.appendChild(div);
  });

  document.querySelectorAll(".option").forEach((lbl) => {
    lbl.addEventListener("click", () => {
      const input = lbl.querySelector("input");
      input.checked = true;

      const qIdx = parseInt(lbl.dataset.q, 10);
      answered[currentQuestions[qIdx].id] = input.value;

      lbl.parentElement
        .querySelectorAll(".option")
        .forEach((o) => o.classList.remove("selected"));
      lbl.classList.add("selected");
    });
  });
}

/***********************
 * TIMER
 ***********************/
function startTimer(seconds) {
  timeLeft = seconds;
  updateTimer();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimer();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      autoSubmit("Waktu habis");
    }
  }, 1000);
}

function updateTimer() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  document.getElementById("timer").textContent =
    "Waktu: " + m + ":" + (s < 10 ? "0" + s : s);
}

/***********************
 * SUBMIT & KIRIM DATA
 ***********************/
function collectAndSend(reason = "manual") {
  if (submitted) return;
  submitted = true;

  clearInterval(timerInterval);

  const answers = {};
  let score = 0;

  currentQuestions.forEach((q, i) => {
    const sel = document.querySelector(`input[name=q${i}]:checked`);
    answers[q.id] = sel ? sel.value : "";
    if (answers[q.id] === q.correct) score++;
  });

  const payload = {
    name: studentName,
    nim: studentNIM,
    class: studentClass,
    score,
    detail: answers,
    reason,
    timestamp: new Date().toISOString(),
  };

  localStorage.setItem("lastExamResult", JSON.stringify(payload));

  fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    mode: "no-cors",
  }).catch(() => {});

  document.getElementById("exam-page").style.display = "none";
  document.getElementById("result-page").style.display = "flex";

  document.getElementById(
    "result-text"
  ).textContent = `Nama: ${studentName} | NIM: ${studentNIM} | Skor: ${score}/${currentQuestions.length}`;

  setTimeout(showReview, 800);
}

/***********************
 * AUTO SUBMIT
 ***********************/
function autoSubmit(reason) {
  if (submitted) return;
  alert("Ujian dihentikan: " + reason);
  collectAndSend(reason);
}

/***********************
 * REVIEW JAWABAN
 ***********************/
function showReview() {
  const data = JSON.parse(localStorage.getItem("lastExamResult"));
  if (!data) return;

  const container = document.getElementById("review-container");
  container.innerHTML = "";

  currentQuestions.forEach((q, i) => {
    const userAns = data.detail[q.id] || "(Tidak dijawab)";
    const correct = q.correct;
    const benar = userAns === correct;

    const div = document.createElement("div");
    div.innerHTML = `
      <p><strong>${i + 1}. ${q.text}</strong></p>
      <p>Jawaban kamu: 
        <span style="color:${benar ? "green" : "red"}">${userAns}</span>
      </p>
      ${
        !benar
          ? `<p>Jawaban benar: <b>${correct}</b></p>`
          : ""
      }
      <hr>
    `;
    container.appendChild(div);
  });

  document.getElementById("result-page").style.display = "none";
  document.getElementById("review-page").style.display = "block";
}

/***********************
 * ANTI CHEAT
 ***********************/
function setupAntiCheat() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) autoSubmit("Pindah tab");
  });

  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("copy", (e) => {
    e.preventDefault();
    autoSubmit("Copy terdeteksi");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "F12") autoSubmit("DevTools");
    if (e.ctrlKey && ["c", "v", "x"].includes(e.key.toLowerCase()))
      autoSubmit("Shortcut dilarang");
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && !submitted)
      autoSubmit("Keluar fullscreen");
  });
}

/***********************
 * FULLSCREEN
 ***********************/
async function enterFullscreen() {
  try {
    await document.documentElement.requestFullscreen();
  } catch (e) {}
}

/***********************
 * START UJIAN
 ***********************/
document.getElementById("start-btn").addEventListener("click", async () => {
  studentName = document.getElementById("student-name").value.trim();
  studentNIM = document.getElementById("student-nim").value.trim();
  studentClass = document.getElementById("student-class").value.trim();

  if (!studentName || !studentNIM || !studentClass) {
    alert("Lengkapi data!");
    return;
  }

  await loadQuestions();
  currentQuestions = shuffle([...questions]);

  renderQuestions();

  document.getElementById("login-page").style.display = "none";
  document.getElementById("exam-page").style.display = "block";

  document.getElementById(
    "info-student"
  ).textContent = `${studentName} • ${studentNIM} • ${studentClass}`;

  setupAntiCheat();
  await enterFullscreen();

  startTimer(currentQuestions.length * 60);
});

/***********************
 * SUBMIT MANUAL
 ***********************/
document.getElementById("submit-btn").addEventListener("click", () => {
  if (confirm("Kirim jawaban sekarang?")) collectAndSend("manual");
});

window.addEventListener("beforeunload", (e) => {
  if (!submitted) {
    e.preventDefault();
    e.returnValue = "";
  }
});
