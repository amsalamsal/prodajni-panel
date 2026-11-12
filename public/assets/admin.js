// Administracija: QR kodovi, kopiranje linkova, prijedlog adrese novog linka, potvrda brisanja
(function () {
  function drawQR(text, px) {
    const q = window.SarajkaQR(text, 'H'), n = q.getModuleCount(), quiet = 4;
    const cell = Math.floor(px / (n + quiet * 2)), size = cell * (n + quiet * 2);
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.fillStyle = '#0D3529';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect((k + quiet) * cell, (r + quiet) * cell, cell, cell);
    return c;
  }
  document.querySelectorAll('[data-qr]').forEach(el => { if (window.SarajkaQR) el.appendChild(drawQR(el.dataset.qr, 1200)); });
  document.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => {
    const c = b.closest('.qr').querySelector('canvas'); if (!c) return;
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'sarajka-qr-' + b.dataset.dl + '.png';
    document.body.appendChild(a); a.click(); a.remove();
  });
  document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => {
    const i = document.getElementById(b.dataset.copy);
    const done = () => { b.textContent = 'Kopirano'; setTimeout(() => b.textContent = 'Kopiraj', 1600); };
    (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(done, () => { i.select(); document.execCommand('copy'); done(); });
  });
  const t = document.getElementById('newTitle'), s = document.getElementById('newSlug'), pv = document.getElementById('newPreview');
  if (t && s && pv) {
    let touched = false;
    const slug = v => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    const upd = () => pv.textContent = pv.dataset.base + '?p=' + (s.value || '…');
    t.addEventListener('input', () => { if (!touched) s.value = slug(t.value); upd(); });
    s.addEventListener('input', () => { touched = true; s.value = slug(s.value); upd(); });
  }
  document.querySelectorAll('form[data-confirm]').forEach(f => f.addEventListener('submit', e => {
    if (f.dataset.sure) return;
    e.preventDefault(); f.dataset.sure = 1; f.querySelector('button').textContent = f.dataset.confirm;
  }));
})();
