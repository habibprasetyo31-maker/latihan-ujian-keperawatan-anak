const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyxqwYcNIqVAjV_KSRO6QiIXMJ2dYdvLehVPAOmAaWKg5l8KhZinhGdrrv1sZEs5ZbZ/exec";
async function loadResults() {
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    const data = await res.json();
    const tbody = document.getElementById('result-body');
    tbody.innerHTML = '';
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="5">Belum ada data</td></tr>';
      return;
    }
    data.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${new Date(r.timestamp).toLocaleString()}</td><td>${r.name}</td><td>${r.nim}</td><td>${r.class}</td><td>${r.score}</td>`;
      tbody.appendChild(tr);
    });
  } catch(e) {
    console.error('Gagal memuat hasil', e);
    document.getElementById('result-body').innerHTML = '<tr><td colspan="5">Error memuat data</td></tr>';
  }
}
window.addEventListener('DOMContentLoaded', loadResults);
