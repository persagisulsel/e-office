/* =========================================================================
 * PORTAL DPD PERSAGI SULAWESI SELATAN — Frontend (PWA)
 * SSO admin · Generate Surat · Data Pengurus · Pengaturan · tautan Sertifikat
 * ========================================================================= */
(function () {
  'use strict';
  const CFG = window.PORTAL_CONFIG || {};
  const SSO_KEY = 'persagi_sso';
  const S = { user: null, p: {}, pengurus: [], penomoran: {}, gambar: {}, surat: [], tahunList: new Date().getFullYear(), harusGanti: false };
  let D = null;            // surat yang sedang disunting
  let kotor = false;       // ada perubahan belum disimpan

  /* ---------------- Utilitas ---------------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const salin = o => JSON.parse(JSON.stringify(o));
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const hariIni = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const tglObj = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const tglSah = s => /^\d{4}-\d{2}-\d{2}/.test(String(s || ''));
  const fmtTgl = s => { if (!tglSah(s)) return ''; const d = tglObj(s); return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); };
  const fmtHariTgl = s => tglSah(s) ? HARI[tglObj(s).getDay()] + ', ' + fmtTgl(s) : '';
  function fmtRentang(a, b) {
    if (!tglSah(a)) return '';
    if (!tglSah(b) || a === b) return fmtHariTgl(a);
    const A = tglObj(a), B = tglObj(b), ha = HARI[A.getDay()], hb = HARI[B.getDay()];
    if (A.getFullYear() === B.getFullYear()) {
      if (A.getMonth() === B.getMonth()) return `${ha}-${hb}, ${A.getDate()}-${B.getDate()} ${BULAN[B.getMonth()]} ${B.getFullYear()}`;
      return `${ha}-${hb}, ${A.getDate()} ${BULAN[A.getMonth()]} - ${B.getDate()} ${BULAN[B.getMonth()]} ${B.getFullYear()}`;
    }
    return fmtHariTgl(a) + ' - ' + fmtHariTgl(b);
  }
  function fmtJam(m, s, z) {
    if (!m) return '';
    const f = x => x.replace(':', '.');
    return 'Pukul ' + f(m) + ' ' + z + (s ? ' – ' + f(s) + ' ' + z : ' - Selesai');
  }
  // **tebal**  __garis bawah__  _miring_
  const fmtBaris = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<u>$1</u>').replace(/(^|\s)_(.+?)_(?=\s|$|[.,;:])/g, '$1<i>$2</i>');
  const baris = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const ktaSah = k => /^\d{17}$/.test(String(k || '').trim());
  const ketKta = k => { const t = String(k || '').trim(); if (!t || t === '-') return 'KTA kosong'; const n = t.replace(/\D/g, '').length; if (/\D/.test(t)) return 'KTA berisi selain angka'; return n + ' digit (seharusnya 17)'; };
  const pengurusById = id => S.pengurus.find(x => x.id === id);
  const aktif = v => !(v === false || String(v).toUpperCase() === 'FALSE');
  const SUDAH_TTD = ['ditandatangani', 'terkirim', 'terbit'];
  const STATUS = { draf: ['draf', 'Draf'], diajukan: ['biru', 'Menunggu TTD'], dikembalikan: ['peringatan', 'Dikembalikan'], ditandatangani: ['terbit', 'Ditandatangani'], terbit: ['terbit', 'Ditandatangani'], terkirim: ['kirim', 'Terkirim'], batal: ['batal', 'Batal'] };
  const lencanaStatus = st => `<span class="lencana ${(STATUS[st] || ['', ''])[0]}">${esc((STATUS[st] || ['', st])[1])}</span>`;
  const isKetua = () => !!(S.user && S.user.peran === 'ketua');
  const sudahTtd = d => SUDAH_TTD.includes(d.status);
  const bisaEdit = d => !d.status || d.status === 'draf' || d.status === 'dikembalikan' || (d.status === 'diajukan' && isKetua() && d.modeEdit);
  const alamatPortal = () => location.origin + location.pathname;
  function nomorWa(hp) { let n = String(hp || '').replace(/\D/g, ''); if (n.startsWith('0')) n = '62' + n.slice(1); else if (n.startsWith('8')) n = '62' + n; return n; }
  const linkWa = (hp, teks) => `https://wa.me/${nomorWa(hp)}?text=${encodeURIComponent(teks)}`;
  const akunKetua = () => (S.akun || []).filter(a => a.peran === 'ketua');
  const akunSekretaris = () => (S.akun || []).filter(a => a.peran !== 'ketua');
  /** Modal berisi tombol WA (dibuka lewat klik pengguna agar tidak diblokir peramban/HP). */
  function modalWa(judul, pesan, tujuan, teks) {
    const ada = tujuan.filter(a => nomorWa(a.hp).length >= 10);
    return modal({ judul, isi: `<div style="line-height:1.6">${pesan}</div>${ada.length ? `<div class="deret" style="margin-top:14px">${ada.map(a => `<a class="btn wa" target="_blank" rel="noopener" href="${linkWa(a.hp, teks)}">💬 Kabari ${esc(a.nama)} via WA</a>`).join('')}</div>` : `<div class="peringatan-box" style="margin-top:12px">Nomor WA ${tujuan.length ? esc(tujuan.map(a => a.nama).join(', ')) : 'tujuan'} belum diisi. Atur di Pengaturan → Akun admin.</div>`}`, tombol: [{ label: 'Tutup', kelas: 'utama-b' }] });
  }
  const fontStack = n => ({ 'Cambria': "Cambria, 'Caladea', Georgia, serif", 'Arial': "Arial, 'Arimo', Helvetica, sans-serif", 'Times New Roman': "'Times New Roman', Times, serif", 'Calibri': "Calibri, Carlito, 'Arimo', sans-serif", 'Bookman Old Style': "'Bookman Old Style', 'Caladea', serif" }[n] || n);

  /* ---------------- SSO ---------------- */
  function bacaSSO() { try { const o = JSON.parse(localStorage.getItem(SSO_KEY) || 'null'); return o && o.exp > Date.now() ? o : null; } catch (e) { return null; } }
  function simpanSSO(o) { localStorage.setItem(SSO_KEY, JSON.stringify(o)); }
  function hapusSSO() { localStorage.removeItem(SSO_KEY); S.user = null; }

  /* ---------------- UI kecil ---------------- */
  let nMuat = 0;
  function muat(on) {
    nMuat += on ? 1 : -1;
    let el = $('#muat');
    if (nMuat > 0 && !el) { el = document.createElement('div'); el.id = 'muat'; el.className = 'muat'; el.innerHTML = '<div><span class="putar"></span><span>Memproses…</span></div>'; document.body.appendChild(el); }
    if (nMuat <= 0) { nMuat = 0; el && el.remove(); }
  }
  function toast(t, jenis = '') {
    const el = document.createElement('div'); el.className = 'tst ' + jenis; el.textContent = t;
    $('#toast').appendChild(el); setTimeout(() => el.remove(), jenis === 'galat' ? 6000 : 3200);
  }
  function modal({ judul, isi, tombol = [], lebar, kunci = false }) {
    return new Promise(res => {
      const l = document.createElement('div'); l.className = 'modal-latar';
      l.innerHTML = `<div class="modal" style="${lebar ? 'max-width:' + lebar + 'px' : ''}"><div class="mk"><b>${judul}</b>${kunci ? '' : '<button data-x>×</button>'}</div><div class="mi">${isi}</div>${tombol.length ? '<div class="mf">' + tombol.map((t, i) => `<button class="btn ${t.kelas || ''}" data-i="${i}">${t.label}</button>`).join('') + '</div>' : ''}</div>`;
      document.body.appendChild(l);
      const tutup = v => { l.remove(); res(v); };
      if (!kunci) { $('[data-x]', l).onclick = () => tutup(null); l.addEventListener('mousedown', e => { if (e.target === l) tutup(null); }); }
      $$('[data-i]', l).forEach(b => b.onclick = async () => {
        const t = tombol[+b.dataset.i];
        if (t.aksi) { const r = await t.aksi(l); if (r === false) return; tutup(r === undefined ? t.nilai : r); } else tutup(t.nilai);
      });
      const f = $('input,select,textarea', $('.mi', l)); f && setTimeout(() => f.focus(), 50);
    });
  }
  const konfirmasi = (judul, pesan, label = 'Ya, lanjutkan', kelas = 'utama-b') => modal({ judul, isi: `<div style="line-height:1.6">${pesan}</div>`, tombol: [{ label: 'Batal', nilai: false }, { label, kelas, nilai: true }] });

  /* ---------------- API ---------------- */
  async function api(action, data = {}, opsi = {}) {
    const sso = bacaSSO();
    if (!opsi.diam) muat(true);
    try {
      const r = await fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify(Object.assign({ action, token: sso && sso.token }, data)) });
      const j = await r.json();
      if (j.error === 'SESI_HABIS') { hapusSSO(); toast('Sesi berakhir, silakan login kembali.', 'galat'); location.hash = '#/login'; throw new Error('SESI_HABIS'); }
      if (!j.ok) throw new Error(j.pesan || 'Terjadi kesalahan.');
      return j;
    } catch (e) {
      if (e instanceof TypeError) throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet / API_URL di config.js.');
      throw e;
    } finally { if (!opsi.diam) muat(false); }
  }
  async function muatInit() {
    const r = await api('init');
    S.user = r.user; S.p = r.pengaturan; S.penomoran = r.penomoran; S.pengurus = r.pengurus; S.gambar = r.gambar || {}; S.akun = r.akun || [];
  }

  /* ---------------- Router ---------------- */
  window.addEventListener('hashchange', () => route());
  window.addEventListener('beforeunload', e => { if (kotor) { e.preventDefault(); e.returnValue = ''; } });
  let hashSebelum = location.hash;
  async function route() {
    const h = location.hash || '#/';
    if (kotor && !h.startsWith('#/surat/') && hashSebelum.startsWith('#/surat/')) {
      if (!confirm('Perubahan surat belum disimpan. Tinggalkan halaman ini?')) { history.replaceState(null, '', hashSebelum); return; }
      kotor = false;
    }
    hashSebelum = h;
    const [jalur, qs] = h.slice(1).split('?');
    const q = new URLSearchParams(qs || '');
    if (jalur.startsWith('/v/')) return viewVerifikasi(jalur.slice(3));
    const sso = bacaSSO();
    if (jalur.startsWith('/login') || !sso) {
      if (sso && q.get('next')) return lanjutKe(q.get('next'));
      return viewLogin(q.get('next') || (sso || jalur === '/' || jalur.startsWith('/login') ? null : location.href));
    }
    if (!S.user) {
      try { await muatInit(); } catch (e) { if (e.message !== 'SESI_HABIS') { $('#app').innerHTML = `<div class="kosong">${esc(e.message)}<br><br><button class="btn" onclick="location.reload()">Coba lagi</button></div>`; } return; }
      if (sso.harusGanti) setTimeout(() => { if (!$('#pwL')) modalGantiPassword(true); }, 300);
    }
    const p = jalur.split('/').filter(Boolean);
    window.scrollTo(0, 0);
    if (!p.length) return viewBeranda();
    if (p[0] === 'surat') {
      if (!p[1]) return viewSuratDaftar();
      if (p[1] === 'baru') return bukaEditor({ jenis: p[2] || 'umum' });
      if (p[1] === 'salin') return bukaEditor({ salinDari: p[2] });
      return bukaEditor({ id: p[1] });
    }
    if (p[0] === 'pengurus') return viewPengurus();
    if (p[0] === 'pengaturan') return viewPengaturan(p[1] || 'ttd');
    location.hash = '#/';
  }
  function lanjutKe(next) {
    try {
      const u = new URL(next, location.href);
      if (u.origin === location.origin) {
        if (u.pathname === location.pathname) { if (location.hash === u.hash) route(); else location.hash = u.hash || '#/'; }
        else location.href = u.href;
        return;
      }
    } catch (e) { }
    location.hash = '#/';
  }

  /* ---------------- Login ---------------- */
  function viewLogin(next) {
    $('#app').innerHTML = `
    <div class="login-wrap"><div class="login-kartu">
      <img src="assets/logo.png" alt="PERSAGI">
      <h1>${esc(CFG.NAMA || 'Portal PERSAGI Sulsel')}</h1>
      <p class="sub">${esc(CFG.SUB || '')}</p>
      <div class="pita"></div>
      <form id="fLogin">
        <label class="f"><span>Username</span><input type="text" name="u" autocomplete="username" required></label>
        <label class="f"><span>Password</span><input type="password" name="p" autocomplete="current-password" required></label>
        <button class="btn utama-b blok" style="padding:11px">Masuk</button>
        <p class="petunjuk" style="margin:14px 0 0;text-align:center">Khusus admin DPD PERSAGI Sulsel. Satu kali login untuk semua aplikasi.</p>
      </form>
    </div></div>`;
    $('#fLogin').onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      try {
        const r = await api('login', { username: f.u.value, password: f.p.value });
        simpanSSO({ token: r.token, username: r.username, nama: r.nama, peran: r.peran, exp: r.exp, harusGanti: r.harusGanti });
        S.user = null;
        S.user = null;
        if (next && !r.harusGanti) return lanjutKe(next);
        if (location.hash === '#/') route(); else location.hash = '#/';
      } catch (er) { toast(er.message, 'galat'); }
    };
  }
  async function keluar() {
    if (!(await konfirmasi('Keluar', 'Keluar dari portal? Semua aplikasi yang memakai login ini juga ikut keluar.', 'Keluar', 'merah'))) return;
    try { await api('logout', {}, { diam: true }); } catch (e) { }
    hapusSSO(); kotor = false; location.hash = '#/login';
  }
  function modalGantiPassword(wajib) {
    return modal({
      judul: wajib ? 'Ganti password awal' : 'Ganti password', kunci: wajib,
      isi: `${wajib ? '<div class="info-box">Demi keamanan, ganti password bawaan sebelum memakai portal.</div>' : ''}
        <label class="f"><span>Password lama</span><input type="password" id="pwL"></label>
        <label class="f"><span>Password baru <i>(min. 6 karakter)</i></span><input type="password" id="pwB"></label>
        <label class="f"><span>Ulangi password baru</span><input type="password" id="pwU"></label>`,
      tombol: [...(wajib ? [] : [{ label: 'Batal' }]), {
        label: 'Simpan', kelas: 'utama-b', aksi: async l => {
          const b = $('#pwB', l).value;
          if (b !== $('#pwU', l).value) { toast('Ulangan password tidak sama.', 'galat'); return false; }
          try { await api('gantiPassword', { lama: $('#pwL', l).value, baru: b }); const s = bacaSSO(); s.harusGanti = false; simpanSSO(s); toast('Password berhasil diganti.', 'sukses'); return true; }
          catch (e) { toast(e.message, 'galat'); return false; }
        }
      }]
    });
  }

  /* ---------------- Kerangka ---------------- */
  function kerangka(menu, html) {
    const sert = S.p.urlSertifikat;
    const item = (h, ik, t, k) => `<a href="${h}" class="${menu === k ? 'aktif' : ''}"><span class="ikon">${ik}</span>${t}</a>`;
    $('#app').innerHTML = `
    <div class="kerangka">
      <aside class="samping" id="samping">
        <div class="merek"><img src="assets/logo.png" alt=""><b>${esc(CFG.NAMA || 'Portal PERSAGI Sulsel')}</b><small>${esc(CFG.SUB || '')}</small></div>
        <nav>
          ${item('#/', '🏠', 'Beranda', 'beranda')}
          <div class="sek">Aplikasi</div>
          ${item('#/surat', '✉️', 'Generate Surat' + (S.hitung ? ` <span class="titik">${S.hitung}</span>` : ''), 'surat')}
          <a href="${sert ? esc(sert) : '#/pengaturan/integrasi'}" ${sert ? '' : 'title="Atur tautan di Pengaturan"'}><span class="ikon">🎓</span>${esc(S.p.namaAplikasiSertifikat || 'Kegiatan & Sertifikat')}${sert ? '' : ' <small style="opacity:.6">(atur)</small>'}</a>
          <div class="sek">Data</div>
          ${item('#/pengurus', '👥', 'Data Pengurus', 'pengurus')}
          ${item('#/pengaturan', '⚙️', 'Pengaturan', 'pengaturan')}
        </nav>
        <div class="kaki">Masuk sebagai <b>${esc(S.user && S.user.nama)}</b> <span style="opacity:.7">(${isKetua() ? 'Ketua' : 'Sekretaris'})</span><br><a href="#" id="btnKeluar" style="color:#ffd54a">Keluar</a></div>
      </aside>
      <div class="utama">
        <div class="atas"><button id="btnMenu">☰</button><img src="assets/logo.png" alt=""><b>${esc(CFG.NAMA || '')}</b></div>
        <main class="isi-utama" id="main">${html}</main>
      </div>
    </div>`;
    $('#btnKeluar').onclick = e => { e.preventDefault(); keluar(); };
    $('#btnMenu').onclick = () => $('#samping').classList.toggle('buka');
    $$('#samping nav a').forEach(a => a.addEventListener('click', () => $('#samping').classList.remove('buka')));
    $('#samping').addEventListener('click', e => { if (e.target.id === 'samping') e.target.classList.remove('buka'); });
  }

  /* ================= BERANDA ================= */
  async function viewBeranda() {
    const th = new Date().getFullYear();
    const perluCek = S.pengurus.filter(x => aktif(x.aktif) && !ktaSah(x.kta)).length;
    const sert = S.p.urlSertifikat;
    kerangka('beranda', `
      <div class="judul-hal"><div><h2>Selamat datang, ${esc(S.user.nama)}</h2><p>Portal layanan administrasi DPD PERSAGI Sulawesi Selatan</p></div></div>
      <div class="statistik">
        <div class="stat"><small>Nomor surat terakhir ${th}</small><b>${String(S.penomoran[th] || 0).padStart(3, '0')}</b></div>
        <div class="stat"><small>Surat ditandatangani ${th}</small><b id="stTerbit">…</b></div>
        <div class="stat"><small>${isKetua() ? 'Menunggu tanda tangan Anda' : 'Menunggu TTD Ketua'}</small><b id="stDraf">…</b></div>
        <div class="stat"><small>Pengurus aktif</small><b>${S.pengurus.filter(x => aktif(x.aktif)).length}</b></div>
        <a class="stat" href="#/pengurus?cek=1" style="text-decoration:none"><small>KTA perlu dicek</small><b style="color:${perluCek ? 'var(--oranye)' : 'var(--hijau)'}">${perluCek}</b></a>
      </div>
      <div id="tugasSaya"></div>
      <div class="grid-ubin">
        <a class="ubin" href="#/surat"><div class="ik">✉️</div><b>Generate Surat</b><span>Undangan, permohonan, balasan, surat tugas — nomor otomatis</span></a>
        <a class="ubin" href="${sert ? esc(sert) : '#/pengaturan/integrasi'}"><div class="ik">🎓</div><b>${esc(S.p.namaAplikasiSertifikat || 'Kegiatan & Sertifikat')}</b><span>${sert ? 'Daftar hadir, materi, dan sertifikat kegiatan' : 'Belum dihubungkan — klik untuk mengatur tautan'}</span></a>
        <a class="ubin" href="#/pengurus"><div class="ik">👥</div><b>Data Pengurus</b><span>Nama, jabatan, dan KTA pengurus periode 2026–2031</span></a>
        <a class="ubin" href="#/pengaturan"><div class="ik">⚙️</div><b>Pengaturan</b><span>TTD, stempel, kop, penomoran, akun admin</span></a>
      </div>
      <div class="kartu" style="margin-top:18px"><h3>Surat terbaru <a class="btn kecil" href="#/surat">Lihat semua</a></h3><div id="terbaru"><div class="kosong">Memuat…</div></div></div>`);
    try {
      const r = await api('surat.list', { tahun: th }, { diam: true });
      S.surat = r.data; S.penomoran = r.penomoran;
      hitungTugas();
      $('#stTerbit') && ($('#stTerbit').textContent = r.data.filter(x => SUDAH_TTD.includes(x.status)).length);
      $('#stDraf') && ($('#stDraf').textContent = r.data.filter(x => x.status === 'diajukan').length);
      const kel = isKetua()
        ? [['✍️ Menunggu tanda tangan Anda', r.data.filter(x => x.status === 'diajukan')]]
        : [['↩️ Dikembalikan Ketua — perlu diperbaiki', r.data.filter(x => x.status === 'dikembalikan')], ['📤 Sudah ditandatangani — siap dikirim', r.data.filter(x => x.status === 'ditandatangani')]];
      const isi = kel.filter(k => k[1].length).map(k => `<div class="kartu sorot"><h3>${k[0]} <span class="lencana biru">${k[1].length}</span></h3>${k[1].map(x => `<a class="baris-tugas" href="#/surat/${esc(x.id)}"><b>${esc(x.perihal) || '(tanpa perihal)'}</b><small>${esc(x.ringkas)}${x.status === 'dikembalikan' && x.catatan ? ' · Catatan: ' + esc(x.catatan) : ''}</small><span>Buka →</span></a>`).join('')}</div>`).join('');
      $('#tugasSaya') && ($('#tugasSaya').innerHTML = isi ? isi + '<div style="height:14px"></div>' : '');
      const nav = $('#samping nav a[href="#/surat"]'); if (nav && S.hitung && !nav.querySelector('.titik')) nav.insertAdjacentHTML('beforeend', ` <span class="titik">${S.hitung}</span>`);
      const t = [...r.data].sort((a, b) => String(b.diubah).localeCompare(String(a.diubah))).slice(0, 6);
      $('#terbaru') && ($('#terbaru').innerHTML = t.length ? tabelSurat(t, true) : '<div class="kosong">Belum ada surat. <a href="#/surat">Buat surat pertama</a></div>');
    } catch (e) { $('#terbaru') && ($('#terbaru').innerHTML = `<div class="kosong">${esc(e.message)}</div>`); }
  }

  function hitungTugas() {
    const l = S.surat || [];
    S.hitung = isKetua() ? l.filter(x => x.status === 'diajukan').length : l.filter(x => x.status === 'dikembalikan' || x.status === 'ditandatangani').length;
  }

  /* ================= VERIFIKASI PUBLIK (kode QR) ================= */
  async function viewVerifikasi(kode) {
    $('#app').innerHTML = `<div class="login-wrap"><div class="login-kartu" style="max-width:460px"><img src="assets/logo.png" alt=""><h1>Verifikasi Surat</h1><p class="sub">DPD PERSAGI Sulawesi Selatan</p><div class="pita"></div><div id="hasilV" style="text-align:left"><div class="kosong">Memeriksa…</div></div></div></div>`;
    try {
      const r = await fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'verifikasi', kode }) }).then(x => x.json());
      const el = $('#hasilV');
      if (!r.ok || !r.ditemukan) { el.innerHTML = `<div class="peringatan-box" style="font-size:14px;text-align:center">❌ Surat dengan kode <b>${esc(kode)}</b> <b>tidak terdaftar</b> di DPD PERSAGI Sulawesi Selatan.</div>`; return; }
      const batal = r.status === 'batal';
      el.innerHTML = `<div style="text-align:center;margin-bottom:14px"><span class="lencana ${batal ? 'batal' : 'terbit'}" style="font-size:14px;padding:6px 14px">${batal ? '⚠ SURAT DIBATALKAN' : '✔ SURAT ASLI & TERDAFTAR'}</span></div>
        <table class="tb"><tbody>
          <tr><td style="color:var(--abu)">Nomor</td><td class="mono"><b>${esc(r.nomor)}</b></td></tr>
          <tr><td style="color:var(--abu)">Tanggal</td><td>${fmtTgl(r.tanggal)}</td></tr>
          <tr><td style="color:var(--abu)">Perihal</td><td>${esc(r.perihal)}</td></tr>
          <tr><td style="color:var(--abu)">Ditandatangani</td><td>${esc(r.penandatangan)}<br><small style="color:var(--abu)">${esc(String(r.ttdPada).replace('T', ' '))}</small></td></tr>
        </tbody></table>
        <p class="petunjuk" style="margin:12px 0 0;text-align:center">Pastikan nomor dan perihal di atas sama dengan surat yang Anda terima.</p>`;
    } catch (e) { $('#hasilV').innerHTML = `<div class="kosong">Tidak dapat memeriksa saat ini. ${esc(e.message)}</div>`; }
  }

  /* ================= DAFTAR SURAT ================= */
  const JENIS = {
    undangan: { label: 'Undangan', ikon: '📨', format: 'biasa', perihal: 'Undangan ', ket: 'Rapat, pertemuan, kegiatan' },
    permohonan: { label: 'Permohonan', ikon: '🙋', format: 'biasa', perihal: 'Permohonan Narasumber', ket: 'Narasumber, juri, moderator, izin' },
    balasan: { label: 'Balasan / Pemberitahuan', ikon: '↩️', format: 'biasa', perihal: '', ket: 'Menjawab surat masuk, informasi' },
    tugas: { label: 'Surat Tugas', ikon: '🪪', format: 'tugas', perihal: 'Surat Tugas', ket: 'Satu atau banyak petugas' },
    umum: { label: 'Surat Umum', ikon: '📝', format: 'biasa', perihal: '', ket: 'Isi bebas' }
  };
  const AWAL = {
    undangan: { kegiatan: '', tgl1: '', tgl2: '', jam1: '', jam2: '', tempat: '', tebal: true, penutup: 'Mohon kehadiran tepat waktu sesuai dengan jadwal di atas. Demikian penyampaian ini, atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.' },
    permohonan: { peran: 'narasumber', kegiatan: '', tema: '', tgl1: '', tgl2: '', jam1: '', jam2: '', tempat: '', nama: '', selaku: '', penutup: 'Demikian kami sampaikan, atas perhatiannya diucapkan terima kasih.' },
    balasan: { rujNomor: '', rujTanggal: '', rujPerihal: '', poin: '', penutup: 'Demikian penyampaian kami, atas perhatian dan kerjasamanya kami ucapkan terima kasih.' },
    tugas: { peran: '', kegiatan: '', tgl1: '', tgl2: '', tempat: '' },
    umum: {}
  };

  function tabelSurat(list, ringkas) {
    return `<div class="tabel-wrap"><table class="tb"><thead><tr><th>Nomor</th><th>Tanggal</th><th>Jenis</th><th>Perihal / Tujuan</th><th>Status</th>${ringkas ? '' : '<th style="width:1%">Aksi</th>'}</tr></thead><tbody>
      ${list.map(s => `<tr>
        <td class="mono">${s.nomor ? esc(s.nomor) : '<span style="color:#98a2b3">— draf —</span>'}</td>
        <td style="white-space:nowrap">${fmtTgl(s.tanggal)}</td>
        <td>${(JENIS[s.jenis] || {}).ikon || ''} ${esc((JENIS[s.jenis] || {}).label || s.jenis)}</td>
        <td><a href="#/surat/${esc(s.id)}"><b>${esc(s.perihal) || '(tanpa perihal)'}</b></a><br><small style="color:var(--abu)">${esc(s.ringkas)}</small></td>
        <td>${lencanaStatus(s.status)}</td>
        ${ringkas ? '' : `<td><div class="deret" style="flex-wrap:nowrap">
          <a class="btn kecil" href="#/surat/${esc(s.id)}">Buka</a>
          <a class="btn kecil" href="#/surat/salin/${esc(s.id)}" title="Buat surat baru dari surat ini">Salin</a>
          ${!s.nomor && s.status !== 'diajukan' ? `<button class="btn kecil merah" data-batal="${esc(s.id)}" data-st="draf">Hapus</button>` : ''}
          ${s.nomor && s.status !== 'batal' && isKetua() ? `<button class="btn kecil merah" data-batal="${esc(s.id)}" data-st="${esc(s.status)}">Batalkan</button>` : ''}
        </div></td>`}
      </tr>`).join('')}</tbody></table></div>`;
  }

  async function viewSuratDaftar() {
    const th = S.tahunList;
    const daftarTahun = [...new Set([new Date().getFullYear(), ...Object.keys(S.penomoran).map(Number)])].sort((a, b) => b - a);
    kerangka('surat', `
      <div class="judul-hal"><div><h2>Generate Surat</h2><p>Nomor terakhir ${th}: <b class="mono" id="noAkhir">${String(S.penomoran[th] || 0).padStart(3, '0')}</b> — nomor diberikan otomatis saat Ketua menandatangani.</p></div></div>
      <div class="kartu"><h3>Buat surat baru</h3>
        <div class="grid-ubin">${Object.entries(JENIS).map(([k, j]) => `<a class="ubin" href="#/surat/baru/${k}" style="padding:14px"><div class="ik" style="width:40px;height:40px;font-size:19px;margin-bottom:8px">${j.ikon}</div><b>${j.label}</b><span>${j.ket}</span></a>`).join('')}</div>
      </div>
      <div class="kartu"><h3>Buku agenda surat keluar</h3>
        <div class="saring">
          <select id="fTahun">${daftarTahun.map(t => `<option ${t === th ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <select id="fJenis"><option value="">Semua jenis</option>${Object.entries(JENIS).map(([k, j]) => `<option value="${k}">${j.label}</option>`).join('')}</select>
          <select id="fStatus"><option value="">Semua status</option><option value="draf">Draf</option><option value="diajukan">Menunggu TTD</option><option value="dikembalikan">Dikembalikan</option><option value="ditandatangani">Ditandatangani</option><option value="terkirim">Terkirim</option><option value="batal">Batal</option></select>
          <input type="text" id="fCari" placeholder="Cari nomor, perihal, tujuan, nama petugas…">
        </div>
        <div id="daftar"><div class="kosong">Memuat…</div></div>
      </div>`);
    const gambar = () => {
      const j = $('#fJenis').value, st = $('#fStatus').value, c = $('#fCari').value.toLowerCase();
      const l = S.surat.filter(s => (!j || s.jenis === j) && (!st || s.status === st || (st === 'ditandatangani' && s.status === 'terbit')) && (!c || [s.nomor, s.perihal, s.ringkas].join(' ').toLowerCase().includes(c)))
        .sort((a, b) => (Number(b.noUrut) || 9999) - (Number(a.noUrut) || 9999) || String(b.diubah).localeCompare(String(a.diubah)));
      $('#daftar').innerHTML = l.length ? tabelSurat(l) : '<div class="kosong">Tidak ada surat.</div>';
      $$('[data-batal]').forEach(b => b.onclick = () => batalSurat(b.dataset.batal, b.dataset.st).then(ok => ok && muatList()));
    };
    const muatList = async () => {
      try { const r = await api('surat.list', { tahun: S.tahunList }, { diam: true }); S.surat = r.data; S.penomoran = r.penomoran; hitungTugas(); $('#noAkhir') && ($('#noAkhir').textContent = String(S.penomoran[S.tahunList] || 0).padStart(3, '0')); if ($('#daftar')) gambar(); }
      catch (e) { $('#daftar') && ($('#daftar').innerHTML = `<div class="kosong">${esc(e.message)}</div>`); }
    };
    $('#fTahun').onchange = e => { S.tahunList = +e.target.value; $('#daftar').innerHTML = '<div class="kosong">Memuat…</div>'; muatList(); };
    ['fJenis', 'fStatus'].forEach(i => $('#' + i).onchange = gambar);
    $('#fCari').oninput = gambar;
    muatList();
  }

  async function batalSurat(id, status) {
    if (status === 'draf') {
      if (!(await konfirmasi('Hapus draf', 'Draf surat ini akan dihapus permanen.', 'Hapus', 'merah'))) return false;
    } else {
      if (!(await konfirmasi('Batalkan surat', 'Surat akan ditandai <b>BATAL</b>. Nomornya tetap tercatat di buku agenda dan tidak dipakai ulang.', 'Batalkan surat', 'merah'))) return false;
    }
    try { await api('surat.batal', { id }); toast(status === 'draf' ? 'Draf dihapus.' : 'Surat dibatalkan.', 'sukses'); return true; } catch (e) { toast(e.message, 'galat'); return false; }
  }

  /* ================= MODEL SURAT ================= */
  function penandatanganAwal() {
    const pidK = (akunKetua()[0] || {}).pengurusId;
    const p = pengurusById(S.p.penandatanganId) || pengurusById(pidK) || S.pengurus.find(x => x.jabatan === 'Ketua') || {};
    return { pid: p.id || '', nama: p.nama || '', kta: p.kta || '', baris: S.p.ttdBaris || '', pakaiTtd: true, pakaiStempel: true };
  }
  function suratBaru(jenis) {
    const j = JENIS[jenis] || JENIS.umum;
    return {
      id: '', status: 'draf', nomor: '', jenis: JENIS[jenis] ? jenis : 'umum', tanggal: hariIni(),
      data: {
        perihal: j.perihal || '', lampiran: '-', tujuan: '', tujuanNomor: jenis === 'undangan', diTempat: 'Tempat', salam: 'Dengan Hormat,',
        f: salin(AWAL[jenis] || {}), isi: '', isiManual: false,
        judul: 'SURAT TUGAS', dasar: { asal: '', nomor: '', tanggal: '', perihal: '' }, pembuka: '', pembukaManual: false,
        petugas: [], untuk: '', untukManual: false, penutupTugas: 'Demikian agar dapat melaksanakan tugas dengan baik dan penuh tanggung jawab.',
        lampiranAktif: false, lampiranJudul: '', lampiranIsi: '<p><br></p>',
        ttd: penandatanganAwal()
      }
    };
  }

  function tabelJadwal(f, tebal) {
    const z = S.p.zonaWaktu || 'WITA';
    const r = [['Hari/Tanggal', fmtRentang(f.tgl1, f.tgl2)], ['Waktu', fmtJam(f.jam1, f.jam2, z)], ['Tempat', esc(f.tempat)]];
    const b = x => tebal ? '<b>' + x + '</b>' : x;
    return '<table class="detail' + (tebal ? ' lega' : '') + '"><tbody>' + r.map(x => `<tr><td>${b(x[0])}</td><td>${b(': ' + (x[1] || '…'))}</td></tr>`).join('') + '</tbody></table>';
  }
  function daftarPoin(teks) {
    // baris diawali "-" atau "•" menjadi sub-butir dari butir sebelumnya
    const out = []; let cur = null;
    String(teks || '').split('\n').forEach(l => {
      const t = l.trim(); if (!t) return;
      if (/^[-•*]\s+/.test(t) && cur) cur.sub.push(t.replace(/^[-•*]\s+/, ''));
      else { cur = { t, sub: [] }; out.push(cur); }
    });
    if (!out.length) return '';
    return '<ol>' + out.map(o => `<li>${fmtBaris(o.t)}${o.sub.length ? '<ul>' + o.sub.map(s => `<li>${fmtBaris(s)}</li>`).join('') + '</ul>' : ''}</li>`).join('') + '</ol>';
  }
  function susunIsi(d, jenis) {
    const f = d.f || {}, x = v => esc(v) || '…';
    switch (jenis) {
      case 'undangan':
        return `<p class="ind">Sehubungan dengan pelaksanaan ${x(f.kegiatan)}, kami mengundang Bapak/Ibu untuk hadir dan berpartisipasi dalam kegiatan tersebut yang insya Allah akan dilaksanakan pada:</p><p><br></p>${tabelJadwal(f, f.tebal)}<p><br></p><p class="ind">${esc(f.penutup)}</p>`;
      case 'permohonan': {
        const minta = f.nama ? `Bersama ini kami mengajukan permohonan kepada ${esc(f.nama)}${f.selaku ? ' selaku ' + esc(f.selaku) : ''} untuk menjadi ${x(f.peran)} pada kegiatan tersebut.` : `Bersama ini kami mengharapkan kesediaan Bapak/Ibu untuk menjadi ${x(f.peran)} pada kegiatan tersebut.`;
        return `<p class="ind">Sehubungan dengan pelaksanaan kegiatan ${x(f.kegiatan)}${f.tema ? ' dengan tema: ' + esc(f.tema) : ''}, yang insya Allah akan dilaksanakan pada :</p><p><br></p>${tabelJadwal(f, false)}<p><br></p><p class="ind">${minta} ${esc(f.penutup)}</p>`;
      }
      case 'balasan': {
        const ada = baris(f.poin).length;
        return `<p class="ind">Sehubungan dengan surat Saudara Nomor : ${x(f.rujNomor)}, Tanggal ${fmtTgl(f.rujTanggal) || '…'}, perihal ${x(f.rujPerihal)}, maka dengan ini kami sampaikan ${ada ? 'beberapa hal, antara lain :' : 'bahwa …'}</p>${daftarPoin(f.poin)}<p class="ind">${esc(f.penutup)}</p>`;
      }
      default: return '<p class="ind"><br></p>';
    }
  }
  function susunPembuka(d) {
    const a = d.dasar || {};
    if (!a.asal && !a.nomor) return 'Dengan ini Dewan Pimpinan Daerah Persatuan Ahli Gizi Indonesia Provinsi Sulawesi Selatan menugaskan kepada :';
    return `Sehubungan surat dari ${a.asal || '…'}, Nomor : ${a.nomor || '…'}, Tanggal ${fmtTgl(a.tanggal) || '…'}, Perihal ${a.perihal || '…'}, dengan ini kami menugaskan kepada :`;
  }
  function susunUntuk(d) {
    const f = d.f || {}, l = [];
    if (f.peran || f.kegiatan) l.push(`Menjadi **${f.peran || '…'}** pada ${f.kegiatan || '…'}`);
    if (f.tgl1) l.push('Pada Hari/Tanggal : ' + fmtRentang(f.tgl1, f.tgl2).replace(', ', ' / '));
    if (f.tempat) l.push('Tempat : ' + f.tempat);
    return l.join('\n');
  }

  /* ---------------- Sanitasi HTML isi surat ---------------- */
  const TAG_OK = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'OL', 'UL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'SPAN', 'SUP', 'SUB']);
  const KELAS_OK = new Set(['ind', 'ctr', 'detail', 'kotak', 'lega']);
  function bersihkanHtml(html) {
    const doc = new DOMParser().parseFromString('<div>' + (html || '') + '</div>', 'text/html');
    const root = doc.body.firstChild;
    (function jalan(el) {
      [...el.childNodes].forEach(n => {
        if (n.nodeType === 3) return;
        if (n.nodeType !== 1) { n.remove(); return; }
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'IMG', 'SVG', 'LINK', 'META'].includes(n.tagName)) { n.remove(); return; }
        if (n.tagName === 'DIV') { const p = doc.createElement('p'); p.className = n.className; while (n.firstChild) p.appendChild(n.firstChild); n.replaceWith(p); n = p; }
        if (!TAG_OK.has(n.tagName)) { jalan(n); n.replaceWith(...n.childNodes); return; }
        const kls = [...n.classList].filter(c => KELAS_OK.has(c)), cs = n.getAttribute('colspan'), rs = n.getAttribute('rowspan');
        const tebal = n.tagName === 'SPAN' && /font-weight:\s*(bold|700)/.test(n.getAttribute('style') || '');
        [...n.attributes].forEach(a => n.removeAttribute(a.name));
        if (kls.length) n.className = kls.join(' ');
        if (cs) n.setAttribute('colspan', cs); if (rs) n.setAttribute('rowspan', rs);
        if (tebal) { const b = doc.createElement('b'); while (n.firstChild) b.appendChild(n.firstChild); n.replaceWith(b); n = b; }
        jalan(n);
      });
    })(root);
    return root.innerHTML;
  }

  /* ================= RENDER SURAT (persis contoh) ================= */
  function nomorTampil(d) {
    if (d.nomor) return esc(d.nomor);
    const t = tglSah(d.tanggal) ? d.tanggal.split('-') : ['', '1'];
    const fmt = (S.p.formatNomor || '{NO}/DPD-PERSAGI-SULSEL/{BLN}/{THN}').replace('{NO}', '…').replace('{BLN}', ROMAWI[(+t[1] || 1) - 1]).replace('{THN}', t[0]);
    return `<span class="nomor-draf">${esc(fmt)}</span>`;
  }
  function varGaya() {
    const p = S.p;
    return `--f-isi:${fontStack(p.fontIsi || 'Cambria')};--s-isi:${+p.ukuranIsi || 12}pt;--f-tugas:${fontStack(p.fontTugas || 'Arial')};--s-tugas:${+p.ukuranTugas || 12}pt;--f-ttd:${fontStack(p.fontTtd || 'Arial')};--s-ttd:${+p.ukuranTtd || 12}pt;`;
  }
  function htmlTtd(d, contoh) {
    const t = d.data.ttd || {}, p = S.p;
    const tampil = contoh || sudahTtd(d);
    const gTtd = tampil && t.pakaiTtd && S.gambar['ttd_' + t.pid];
    const gStp = tampil && t.pakaiStempel && S.gambar.stempel;
    const qr = !contoh && d.kode && p.pakaiQr !== 'tidak' ? qrDataUrl(alamatPortal() + '#/v/' + d.kode) : '';
    const lebarQr = +p.qrLebar || 0.8;
    return `<div class="ttd">
      <div class="baris">${esc(p.kota || 'Makassar')}, ${fmtTgl(d.tanggal)}</div><div class="sp"></div>
      ${String(t.baris || '').split('\n').map(b => `<div class="baris">${esc(b) || '&nbsp;'}</div>`).join('')}
      <div class="ruang"></div>
      <div class="nm">${esc(t.nama)}</div>
      <div class="kta">${esc(p.labelKta ?? 'KTA : ')}${esc(t.kta)}</div>
      ${gStp ? `<img class="stempel" src="${gStp}" alt="" style="left:${+p.stempelX || 0}in;bottom:${+p.stempelY || 0}in;width:${+p.stempelLebar || 1}in;opacity:${p.stempelOpasitas === '' ? 1 : +p.stempelOpasitas}">` : ''}
      ${gTtd ? `<img class="ttdimg" src="${gTtd}" alt="" style="left:${+p.ttdX || 0}in;bottom:${+p.ttdY || 0}in;width:${+p.ttdLebar || 1.8}in">` : ''}
      ${qr ? `<div class="qr" style="left:-288pt;width:${lebarQr + 1.6}in"><img src="${qr}" alt="" style="width:${lebarQr}in;height:${lebarQr}in"><div><b>Dokumen sah</b><br>Pindai kode QR untuk memverifikasi keaslian surat ini.<br>Kode: ${esc(d.kode)}</div></div>` : ''}
      ${!tampil && !contoh && d.status !== 'batal' ? '<div class="belum-ttd">Belum ditandatangani</div>' : ''}
    </div>`;
  }
  function qrDataUrl(teks) {
    try { const q = window.qrcode(0, 'M'); q.addData(teks); q.make(); return q.createDataURL(8, 0); } catch (e) { return ''; }
  }
  const kopSrc = () => S.gambar.kop || 'assets/kop.png';
  const footerSrc = () => S.gambar.footer || 'assets/footer.png';
  const halaman = (isi, kop = true) => `<div class="pg ${kop ? '' : 'tanpa-kop'}" style="${varGaya()}">${kop ? `<img class="kop" src="${kopSrc()}" alt="">` : ''}<div class="hal">${isi}</div><img class="footer" src="${footerSrc()}" alt=""></div>`;

  function tujuanHtml(d) {
    const l = baris(d.data.tujuan);
    if (!l.length) return '<div>…</div>';
    if (d.data.tujuanNomor && l.length > 1) return l.map((x, i) => `<div class="ln"><span>${i + 1}.</span><span>${fmtBaris(x)}</span></div>`).join('');
    return l.map(x => `<div>${fmtBaris(x)}</div>`).join('');
  }
  function modePetugas(n) {
    const bb = +S.p.batasBlokPetugas || 3, bt = +S.p.batasTabelPetugas || 10;
    return n <= bb ? 'blok' : n <= bt ? 'tabel' : 'lampiran';
  }
  function htmlPetugas(d) {
    const ps = d.data.petugas || [], n = ps.length;
    const bris = (k, v) => `<div class="bris"><span>${k}</span><span>:</span><span>${esc(v) || '…'}</span></div>`;
    if (!n) return `<div class="petugas"><div class="blok"><div></div><div>${bris('Nama', '')}${bris('No. KTA', '')}${bris('Jabatan', '')}</div></div></div>`;
    const m = modePetugas(n);
    if (m === 'blok') return `<div class="petugas">${ps.map((x, i) => `<div class="blok"><div class="no">${n > 1 ? (i + 1) + '.' : ''}</div><div>${bris('Nama', x.nama)}${bris('No. KTA', x.kta)}${bris('Jabatan', x.jabatan)}</div></div>`).join('')}</div>`;
    if (m === 'tabel') return `<div class="petugas">${tabelPetugas(ps, 0)}</div>`;
    return `<div class="petugas" style="margin-left:36pt">Nama-nama sebagaimana tercantum dalam lampiran surat tugas ini.</div>`;
  }
  const tabelPetugas = (ps, mulai) => `<table class="kotak"><thead><tr><th style="width:26pt">No</th><th>Nama</th><th style="width:118pt">No. KTA</th><th>Jabatan</th></tr></thead><tbody>${ps.map((x, i) => `<tr><td style="text-align:center">${mulai + i + 1}</td><td>${esc(x.nama)}</td><td>${esc(x.kta)}</td><td>${esc(x.jabatan)}</td></tr>`).join('')}</tbody></table>`;

  function renderHalaman(d) {
    const dt = d.data, out = [];
    if ((JENIS[d.jenis] || {}).format === 'tugas') {
      const u = baris(dt.untuk);
      out.push(halaman(`<div class="st">
        <div class="judul">${esc(dt.judul || 'SURAT TUGAS')}</div>
        <div class="nomor">Nomor : ${nomorTampil(d)}</div>
        <div class="pembuka">${esc(dt.pembuka)}</div>
        ${htmlPetugas(d)}
        <div class="untuk"><span>Untuk</span><span>:</span><div>${u.length ? u.map((l, i) => `<div class="it"><span>${u.length > 1 ? (i + 1) + '.' : ''}</span><span>${fmtBaris(l)}</span></div>`).join('') : '…'}</div></div>
        <div class="penutup">${esc(dt.penutupTugas)}</div>
        ${htmlTtd(d)}
      </div>`));
      const ps = dt.petugas || [];
      if (modePetugas(ps.length) === 'lampiran') {
        const kepala = `<div class="kepala"><div class="r"><span>Lampiran</span><span>:</span><span>Surat Tugas</span></div><div class="r"><span>Nomor</span><span>:</span><span>${nomorTampil(d)}</span></div><div class="r"><span>Tanggal</span><span>:</span><span>${fmtTgl(d.tanggal)}</span></div></div><div class="jdl">DAFTAR NAMA YANG DITUGASKAN</div>`;
        for (let i = 0, hal = 0; i < ps.length; hal++) {
          const per = hal === 0 ? 32 : 42;
          out.push(halaman(`<div class="lp">${hal === 0 ? kepala : ''}${tabelPetugas(ps.slice(i, i + per), i)}</div>`, false));
          i += per;
        }
      }
      return out;
    }
    out.push(halaman(`<div class="sb">
      <div class="hrow"><span>Nomor</span><span>:</span><span class="v">${nomorTampil(d)}</span></div>
      <div class="hrow"><span>Lampiran</span><span>:</span><span class="v">${esc(dt.lampiran || '-')}</span></div>
      <div class="hrow"><span>Perihal</span><span>:</span><span class="v ph">${esc(dt.perihal)}</span></div>
      <div class="kepada"><div>Kepada yth :</div><div class="tuj">${tujuanHtml(d)}</div><div>Di</div><div class="tempat">${esc(dt.diTempat || 'Tempat')}</div></div>
      <div class="salam">${esc(dt.salam)}</div>
      <div class="isi">${bersihkanHtml(dt.isi)}</div>
      ${htmlTtd(d)}
    </div>`));
    if (dt.lampiranAktif) {
      out.push(halaman(`<div class="lp"><div class="kepala"><div class="r"><span>Lampiran</span><span>:</span><span>Surat DPD PERSAGI Sulsel</span></div><div class="r"><span>Nomor</span><span>:</span><span>${nomorTampil(d)}</span></div><div class="r"><span>Tanggal</span><span>:</span><span>${fmtTgl(d.tanggal)}</span></div><div class="r"><span>Perihal</span><span>:</span><span>${esc(dt.perihal)}</span></div></div>${dt.lampiranJudul ? `<div class="jdl">${esc(dt.lampiranJudul)}</div>` : '<div style="height:18pt"></div>'}<div class="isi">${bersihkanHtml(dt.lampiranIsi)}</div></div>`, false));
    }
    return out;
  }

  function namaFile(d) {
    const no = d.data && d.nomor ? String(d.nomor).split('/')[0] : 'DRAF';
    let t;
    if (d.jenis === 'tugas') { const ps = d.data.petugas || []; t = 'Surat_Tugas' + (ps.length === 1 ? '_' + ps[0].nama : ps.length > 1 ? '_' + ps.length + '_orang' : ''); }
    else t = d.data.perihal || (JENIS[d.jenis] || {}).label || 'Surat';
    return (no + '_' + t).replace(/[\\/:*?"<>|]+/g, ' ').replace(/[\s,]+/g, '_').replace(/_+/g, '_').slice(0, 120) + '.pdf';
  }

  /* ---------------- PDF & cetak ---------------- */
  let h2pMuat = null;
  function muatHtml2pdf() {
    if (window.html2pdf) return Promise.resolve();
    return h2pMuat || (h2pMuat = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/html2pdf.bundle.min.js'; s.onload = res; s.onerror = () => { h2pMuat = null; rej(new Error('Gagal memuat pembuat PDF.')); }; document.head.appendChild(s); }));
  }
  async function siapGambar(el) {
    await (document.fonts && document.fonts.ready);
    await Promise.all($$('img', el).map(i => i.complete && i.naturalWidth ? null : new Promise(r => { i.onload = i.onerror = r; })));
  }
  async function buatPdf(d) {
    await muatHtml2pdf();
    const w = document.createElement('div');
    w.style.cssText = 'position:fixed;left:-30000px;top:0;width:8.5in;';
    w.innerHTML = renderHalaman(d).join('');
    document.body.appendChild(w);
    try {
      await siapGambar(w);
      const pgs = $$('.pg', w);
      const opt = { margin: 0, filename: namaFile(d), image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false }, jsPDF: { unit: 'in', format: [8.5, 13], orientation: 'portrait', compress: true }, pagebreak: { mode: [] } };
      let wk = window.html2pdf().set(opt).from(pgs[0]).toPdf();
      pgs.slice(1).forEach(pg => { wk = wk.get('pdf').then(pdf => { pdf.addPage([8.5, 13], 'portrait'); }).from(pg).toContainer().toCanvas().toPdf(); });
      return await wk.get('pdf');
    } finally { w.remove(); }
  }
  /** Draf: PDF dibuat di perangkat (tanpa TTD). Surat bertanda tangan: ambil PDF final dari arsip server. */
  async function unduhPdf(d) {
    if (sudahTtd(d)) return unduhFinal(d);
    muat(true);
    try { const pdf = await buatPdf(d); pdf.save('DRAF_' + namaFile(d).replace(/^DRAF_/, '')); toast('PDF draf diunduh (belum bernomor & belum ditandatangani).', 'sukses'); }
    catch (e) { toast('Gagal membuat PDF: ' + e.message, 'galat'); }
    finally { muat(false); }
  }
  async function unduhFinal(d) {
    try {
      const r = await api('surat.pdf', { id: d.id });
      const bin = atob(r.base64), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = r.namaFile || namaFile(d); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('PDF final diunduh.', 'sukses');
    } catch (e) {
      if (isKetua() && /belum tersedia/.test(e.message)) { if (await konfirmasi('PDF final belum ada', 'Buat dan simpan PDF final sekarang?', 'Buat PDF')) { if (await arsipkanPdf(d)) return unduhFinal(d); } }
      else toast(e.message, 'galat');
    }
  }
  /** Dijalankan di perangkat Ketua setelah menandatangani: membuat PDF final lalu menyimpannya ke Drive. */
  async function arsipkanPdf(d) {
    muat(true);
    try {
      const pdf = await buatPdf(d);
      const r = await api('surat.simpanPdf', { id: d.id, base64: pdf.output('datauristring'), namaFile: namaFile(d) }, { diam: true });
      d.pdfUrl = r.pdfUrl; return true;
    } catch (e) { toast('PDF final gagal disimpan: ' + e.message + ' — buka surat ini lalu tekan "Simpan ulang PDF".', 'galat'); return false; }
    finally { muat(false); }
  }
  async function cetak(d) {
    const a = $('#cetak-area');
    a.innerHTML = renderHalaman(d).join('');
    muat(true); await siapGambar(a); muat(false);
    setTimeout(() => { window.print(); }, 50);
  }

  /* ================= EDITOR SURAT ================= */
  async function bukaEditor({ id, jenis, salinDari }) {
    try {
      if (id) {
        const r = await api('surat.get', { id });
        D = dariServer(r.item);
      } else if (salinDari) {
        const r = await api('surat.get', { id: salinDari });
        D = suratBaru(r.item.jenis);
        D.data = Object.assign(D.data, salin(r.item.data || {}));
        D.data.ttd = Object.assign(penandatanganAwal(), D.data.ttd || {});
      } else D = suratBaru(jenis);
    } catch (e) { toast(e.message, 'galat'); location.hash = '#/surat'; return; }
    kotor = !!salinDari;
    bisaEdit(D) ? viewEditor() : viewTinjau();
  }
  function dariServer(it) {
    return { id: it.id, status: it.status, nomor: it.nomor, noUrut: it.noUrut, jenis: it.jenis, tanggal: String(it.tanggal).slice(0, 10), pdfUrl: it.pdfUrl, kode: it.kode, catatan: it.catatan, ttdOleh: it.ttdOleh, ttdPada: it.ttdPada, kirim: it.kirim, riwayat: it.riwayat || [], data: Object.assign(suratBaru(it.jenis).data, it.data || {}) };
  }

  function viewEditor() {
    const d = D, dt = d.data, j = JENIS[d.jenis] || JENIS.umum, tugas = j.format === 'tugas';
    const th = (d.tanggal || hariIni()).slice(0, 4);
    const berikut = String((S.penomoran[th] || 0) + 1).padStart(+S.p.digitNomor || 3, '0');
    const pidPenanda = akunKetua().map(a => a.pengurusId).filter(Boolean);
    const opsPengurus = S.pengurus.filter(x => aktif(x.aktif) && (!pidPenanda.length || pidPenanda.includes(x.id) || x.id === dt.ttd.pid)).map(x => `<option value="${esc(x.id)}" ${dt.ttd.pid === x.id ? 'selected' : ''}>${esc(x.nama)} — ${esc(x.jabatan)}</option>`).join('');
    const f = dt.f || {};
    const inp = (k, label, tipe = 'text', ph = '', ket = '') => `<label class="f"><span>${label}${ket ? ' <i>' + ket + '</i>' : ''}</span><input type="${tipe}" data-f="${k}" value="${esc(f[k] ?? '')}" placeholder="${esc(ph)}"></label>`;
    const jadwalF = `<div class="dua">${inp('tgl1', 'Tanggal mulai', 'date')}${inp('tgl2', 'Tanggal selesai', 'date', '', '(opsional)')}</div><div class="dua">${inp('jam1', 'Jam mulai', 'time')}${inp('jam2', 'Jam selesai', 'time', '', '(kosong = Selesai)')}</div>${inp('tempat', 'Tempat', 'text', 'Zoom Meeting (Link Menyusul)')}`;
    let isian = '';
    if (d.jenis === 'undangan') isian = `${inp('kegiatan', 'Nama kegiatan', 'text', 'rapat koordinasi DPD PERSAGI Sulawesi Selatan', '(lanjutan kalimat "Sehubungan dengan pelaksanaan …")')}${jadwalF}<label class="cek"><input type="checkbox" data-f="tebal" ${f.tebal ? 'checked' : ''}> Jadwal dicetak tebal</label><label class="f"><span>Kalimat penutup</span><textarea data-f="penutup" rows="3">${esc(f.penutup)}</textarea></label>`;
    if (d.jenis === 'permohonan') isian = `${inp('peran', 'Permohonan sebagai', 'text', 'narasumber / juri / moderator')}<label class="f"><span>Nama kegiatan</span><textarea data-f="kegiatan" rows="2" placeholder="Kuliah Tamu Program Studi D-III Gizi …">${esc(f.kegiatan)}</textarea></label><label class="f"><span>Tema <i>(opsional)</i></span><textarea data-f="tema" rows="2">${esc(f.tema)}</textarea></label>${jadwalF}<div class="dua"><label class="f"><span>Nama yang dimohon <i>(kosong = penerima surat)</i></span><input type="text" data-f="nama" list="dlPengurus" value="${esc(f.nama)}"></label>${inp('selaku', 'Selaku', 'text', 'Ketua Jurusan Gizi')}</div><label class="f"><span>Kalimat penutup</span><textarea data-f="penutup" rows="2">${esc(f.penutup)}</textarea></label>`;
    if (d.jenis === 'balasan') isian = `<div class="dua">${inp('rujNomor', 'Nomor surat masuk', 'text', '400.8/020/KTKL/RSUDLM')}${inp('rujTanggal', 'Tanggal surat masuk', 'date')}</div>${inp('rujPerihal', 'Perihal surat masuk', 'text', 'Permohonan Kredensial')}<label class="f"><span>Poin-poin isi <i>(satu baris satu poin; awali "- " untuk sub-butir; **tebal**)</i></span><textarea data-f="poin" rows="6" placeholder="Biaya Kredensial sebesar Rp 350.000/orang&#10;Persyaratan berkas:&#10;- STR Ahli Gizi : Aktif&#10;- Ijazah">${esc(f.poin)}</textarea></label><label class="f"><span>Kalimat penutup</span><textarea data-f="penutup" rows="2">${esc(f.penutup)}</textarea></label>`;

    const alat = id => `<div class="alat" data-ed="${id}">
      <button type="button" data-c="bold" title="Tebal"><b>B</b></button><button type="button" data-c="italic" title="Miring"><i>I</i></button><button type="button" data-c="underline" title="Garis bawah"><u>U</u></button>
      <span class="pemisah"></span>
      <button type="button" data-c="insertOrderedList" title="Daftar bernomor">1.</button><button type="button" data-c="insertUnorderedList" title="Daftar butir">•</button>
      <button type="button" data-c="indent" title="Masuk (sub-butir)">→</button><button type="button" data-c="outdent" title="Keluar">←</button>
      <span class="pemisah"></span>
      <button type="button" data-k="ind" title="Menjorok baris pertama">⇥¶</button><button type="button" data-k="ctr" title="Rata tengah">≡</button>
      <span class="pemisah"></span>
      <button type="button" data-t="detail" title="Sisipkan tabel jadwal (Hari/Tanggal : …)">▤ Jadwal</button><button type="button" data-t="kotak" title="Sisipkan tabel bergaris">▦ Tabel</button>
      <button type="button" data-c="removeFormat" title="Hapus format">⌫</button>
    </div>`;

    kerangka('surat', `
      <div class="judul-hal"><div><h2>${j.ikon} ${esc(j.label)}</h2><p>${lencanaStatus(d.status || 'draf')} · nomor diberikan saat Ketua menandatangani (perkiraan <b class="mono">${berikut}</b>)</p></div><a class="btn" href="#/surat">← Daftar surat</a></div>
      ${d.status === 'dikembalikan' && d.catatan ? `<div class="peringatan-box" style="font-size:13.5px">↩️ <b>Dikembalikan Ketua.</b> Catatan: ${esc(d.catatan)}</div>` : ''}
      ${d.modeEdit ? '<div class="info-box">Anda sedang mengedit surat yang diajukan sekretaris. Setelah selesai, tekan <b>Setujui & Tanda Tangani</b>.</div>' : ''}
      <datalist id="dlPengurus">${S.pengurus.filter(x => aktif(x.aktif)).map(x => `<option value="${esc(x.nama)}">`).join('')}</datalist>
      <div class="surat-layout">
        <div>
          <div class="kartu"><h3>Identitas surat</h3>
            <div class="dua"><label class="f"><span>Tanggal surat</span><input type="date" id="eTanggal" value="${esc(d.tanggal)}"></label>
            ${tugas ? `<label class="f"><span>Judul</span><input type="text" data-d="judul" value="${esc(dt.judul)}"></label>` : `<label class="f"><span>Lampiran</span><input type="text" data-d="lampiran" value="${esc(dt.lampiran)}"></label>`}</div>
            ${tugas ? '' : `<label class="f"><span>Perihal</span><input type="text" data-d="perihal" value="${esc(dt.perihal)}"></label>`}
            ${d.status === 'terbit' ? '<div class="info-box">Surat sudah terbit: nomor tetap. Tanggal boleh diubah dalam tahun yang sama; bulan Romawi pada nomor tidak ikut berubah.</div>' : ''}
          </div>

          ${tugas ? `
          <div class="kartu"><h3>Dasar penugasan <small>(opsional)</small></h3>
            <label class="f"><span>Surat dari</span><input type="text" data-dasar="asal" value="${esc(dt.dasar.asal)}" placeholder="Tim Penggerak PKK Kota Makassar"></label>
            <div class="dua"><label class="f"><span>Nomor</span><input type="text" data-dasar="nomor" value="${esc(dt.dasar.nomor)}"></label><label class="f"><span>Tanggal</span><input type="date" data-dasar="tanggal" value="${esc(dt.dasar.tanggal)}"></label></div>
            <label class="f"><span>Perihal</span><input type="text" data-dasar="perihal" value="${esc(dt.dasar.perihal)}" placeholder="Permintaan Juri"></label>
            <label class="f"><span>Kalimat pembuka <i>(tersusun otomatis, boleh diedit)</i></span><textarea id="ePembuka" rows="3">${esc(dt.pembuka)}</textarea></label>
            <button class="btn kecil" id="bPembuka" type="button">↻ Susun ulang dari isian</button>
          </div>
          <div class="kartu"><h3>Yang ditugaskan <small id="infoMode"></small></h3>
            <div class="cari-wrap"><input type="text" id="cariPengurus" placeholder="Ketik nama / jabatan pengurus untuk menambahkan…" autocomplete="off"><div class="cari-hasil tersembunyi" id="hasilCari"></div></div>
            <div class="deret" style="margin:8px 0 12px">
              <select id="pilihKelompok" style="width:auto;flex:1"><option value="">+ Tambah satu kelompok/bidang…</option>${[...new Set(S.pengurus.filter(x => aktif(x.aktif)).map(x => x.kelompok).filter(Boolean))].map(k => `<option>${esc(k)}</option>`).join('')}</select>
              <button class="btn kecil" id="bManual" type="button">+ Bukan pengurus</button>
            </div>
            <div id="daftarPetugas"></div>
          </div>
          <div class="kartu"><h3>Untuk</h3>
            <div class="dua">${inp('peran', 'Menjadi', 'text', 'Juri')}${inp('tempat', 'Tempat', 'text', 'Halaman Kantor TP PKK Kota Makassar')}</div>
            ${inp('kegiatan', 'Pada kegiatan', 'text', 'Kegiatan Lomba Pengolahan Hasil Laut se Kota Makassar')}
            <div class="dua">${inp('tgl1', 'Tanggal mulai', 'date')}${inp('tgl2', 'Tanggal selesai', 'date', '', '(opsional)')}</div>
            <label class="f"><span>Butir "Untuk" <i>(satu baris satu butir; **tebal**)</i></span><textarea id="eUntuk" rows="4">${esc(dt.untuk)}</textarea></label>
            <button class="btn kecil" id="bUntuk" type="button">↻ Susun ulang dari isian</button>
            <label class="f" style="margin-top:12px"><span>Kalimat penutup</span><textarea data-d="penutupTugas" rows="2">${esc(dt.penutupTugas)}</textarea></label>
          </div>` : `
          <div class="kartu"><h3>Tujuan</h3>
            <label class="f"><span>Kepada yth <i>(satu baris satu tujuan; **tebal** otomatis)</i></span><textarea data-d="tujuan" rows="3" placeholder="Kepala UPTD RSUD Regional La Mappapenning Bone">${esc(dt.tujuan)}</textarea></label>
            <label class="cek"><input type="checkbox" data-d="tujuanNomor" ${dt.tujuanNomor ? 'checked' : ''}> Beri nomor bila lebih dari satu tujuan</label>
            <div class="dua"><label class="f"><span>Di</span><input type="text" data-d="diTempat" value="${esc(dt.diTempat)}"></label><label class="f"><span>Salam pembuka</span><input type="text" data-d="salam" value="${esc(dt.salam)}"></label></div>
          </div>
          ${isian ? `<div class="kartu"><h3>Isian ${esc(j.label.toLowerCase())} <small>isi surat tersusun otomatis</small></h3>${isian}</div>` : ''}
          <div class="kartu"><h3>Isi surat <small>${d.jenis === 'umum' ? 'tulis bebas' : 'boleh disunting langsung'}</small></h3>
            ${alat('edIsi')}<div class="editor" id="edIsi" contenteditable="true">${bersihkanHtml(dt.isi)}</div>
            ${d.jenis !== 'umum' ? '<div class="deret" style="margin-top:8px"><button class="btn kecil" id="bSusun" type="button">↻ Susun ulang isi dari isian</button><span class="petunjuk" id="infoManual" style="margin:0"></span></div>' : ''}
          </div>
          <div class="kartu"><h3>Halaman lampiran</h3>
            <label class="cek"><input type="checkbox" data-d="lampiranAktif" ${dt.lampiranAktif ? 'checked' : ''}> Tambahkan halaman lampiran</label>
            <div id="boxLampiran" class="${dt.lampiranAktif ? '' : 'tersembunyi'}">
              <label class="f"><span>Judul lampiran <i>(opsional)</i></span><input type="text" data-d="lampiranJudul" value="${esc(dt.lampiranJudul)}" placeholder="DAFTAR PESERTA"></label>
              ${alat('edLamp')}<div class="editor" id="edLamp" contenteditable="true">${bersihkanHtml(dt.lampiranIsi)}</div>
            </div>
          </div>`}

          <div class="kartu"><h3>Penandatangan</h3>
            <label class="f"><span>Nama</span><select id="ePenanda">${opsPengurus}</select></label>
            <label class="f"><span>Baris jabatan <i>(satu baris per baris)</i></span><textarea id="eBaris" rows="4">${esc(dt.ttd.baris)}</textarea></label>
            <div class="deret"><label class="cek"><input type="checkbox" id="ePakaiTtd" ${dt.ttd.pakaiTtd ? 'checked' : ''}> Bubuhkan TTD</label><label class="cek"><input type="checkbox" id="ePakaiStp" ${dt.ttd.pakaiStempel ? 'checked' : ''}> Bubuhkan stempel</label></div>
            <div id="infoTtd"></div>
          </div>

          <div class="aksi-surat">
            <button class="btn" id="bSimpan">💾 ${d.modeEdit ? 'Simpan perubahan' : 'Simpan draf'}</button>
            ${isKetua() ? '<button class="btn kuning" id="bTtd">✍️ ' + (d.modeEdit ? 'Setujui & Tanda Tangani' : 'Tanda tangani sekarang') + '</button>' : '<button class="btn kuning" id="bAjukan">📨 Ajukan ke Ketua</button>'}
            ${d.modeEdit ? '<button class="btn" id="bBatalEdit">Selesai edit</button>' : '<button class="btn" id="bPdf" title="PDF draf, tanpa nomor dan TTD">⬇ PDF draf</button>'}
          </div>
        </div>
        <div class="panel-pratinjau">
          <div id="peringatan"></div>
          <div class="pratinjau-bingkai" id="bingkai"><div class="pratinjau-skala" id="pratinjau"></div></div>
        </div>
      </div>`);

    // ---- pengikatan ----
    const ubah = () => { kotor = true; jadwalkan(); };
    $('#eTanggal').onchange = e => { d.tanggal = e.target.value; if (d.jenis !== 'tugas' && !dt.isiManual) segarkanIsi(); ubah(); };
    $$('[data-d]').forEach(el => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
      dt[el.dataset.d] = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.d === 'lampiranAktif') { $('#boxLampiran').classList.toggle('tersembunyi', !el.checked); if (el.checked && (!dt.lampiran || dt.lampiran === '-')) { dt.lampiran = '1 (satu) berkas'; const li = $('[data-d=lampiran]'); li && (li.value = dt.lampiran); } }
      ubah();
    }));
    $$('[data-f]').forEach(el => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
      dt.f[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
      if (tugas) { if (!dt.untukManual) { dt.untuk = susunUntuk(dt); $('#eUntuk').value = dt.untuk; } }
      else if (!dt.isiManual) segarkanIsi();
      ubah();
    }));
    function segarkanIsi() { dt.isi = susunIsi(dt, d.jenis); const ed = $('#edIsi'); if (ed) ed.innerHTML = dt.isi; infoManual(); }
    function infoManual() { const i = $('#infoManual'); if (i) i.textContent = dt.isiManual ? 'Isi sudah disunting manual — perubahan isian tidak lagi mengubah isi.' : 'Isi mengikuti isian di atas.'; }

    if (tugas) {
      $$('[data-dasar]').forEach(el => el.addEventListener('input', () => { dt.dasar[el.dataset.dasar] = el.value; if (!dt.pembukaManual) { dt.pembuka = susunPembuka(dt); $('#ePembuka').value = dt.pembuka; } ubah(); }));
      $('#ePembuka').oninput = e => { dt.pembuka = e.target.value; dt.pembukaManual = true; ubah(); };
      $('#bPembuka').onclick = () => { dt.pembukaManual = false; dt.pembuka = susunPembuka(dt); $('#ePembuka').value = dt.pembuka; ubah(); };
      $('#eUntuk').oninput = e => { dt.untuk = e.target.value; dt.untukManual = true; ubah(); };
      $('#bUntuk').onclick = () => { dt.untukManual = false; dt.untuk = susunUntuk(dt); $('#eUntuk').value = dt.untuk; ubah(); };
      if (!dt.pembuka) { dt.pembuka = susunPembuka(dt); $('#ePembuka').value = dt.pembuka; }
      pasangPetugas(ubah);
    } else {
      pasangEditor('edIsi', html => { dt.isi = html; dt.isiManual = true; infoManual(); ubah(); });
      pasangEditor('edLamp', html => { dt.lampiranIsi = html; ubah(); });
      const bs = $('#bSusun');
      if (bs) bs.onclick = async () => { if (dt.isiManual && !(await konfirmasi('Susun ulang isi', 'Isi yang sudah disunting manual akan diganti dengan susunan dari isian. Lanjutkan?'))) return; dt.isiManual = false; segarkanIsi(); ubah(); };
      if (!dt.isi || (!dt.isiManual && d.jenis !== 'umum')) { dt.isi = dt.isi && dt.isiManual ? dt.isi : susunIsi(dt, d.jenis); $('#edIsi').innerHTML = dt.isi; }
      infoManual();
    }

    $('#ePenanda').onchange = e => {
      const p = pengurusById(e.target.value); if (!p) return;
      dt.ttd.pid = p.id; dt.ttd.nama = p.nama; dt.ttd.kta = p.kta;
      const b = String(S.p.ttdBaris || '').split('\n'); if (b.length) b[b.length - 1] = p.jabatan; dt.ttd.baris = b.join('\n'); $('#eBaris').value = dt.ttd.baris;
      infoTtd(); ubah();
    };
    $('#eBaris').oninput = e => { dt.ttd.baris = e.target.value; ubah(); };
    $('#ePakaiTtd').onchange = e => { dt.ttd.pakaiTtd = e.target.checked; infoTtd(); ubah(); };
    $('#ePakaiStp').onchange = e => { dt.ttd.pakaiStempel = e.target.checked; infoTtd(); ubah(); };
    function infoTtd() {
      const m = [];
      if (isKetua() && dt.ttd.pid === S.user.pengurusId) {
        if (dt.ttd.pakaiTtd && !S.gambar['ttd_' + dt.ttd.pid]) m.push('TTD Anda belum diunggah.');
        if (dt.ttd.pakaiStempel && !S.gambar.stempel) m.push('Stempel belum diunggah.');
      }
      if (!ktaSah(dt.ttd.kta)) m.push('KTA penandatangan perlu dicek (' + ketKta(dt.ttd.kta) + ').');
      $('#infoTtd').innerHTML = m.length ? `<div class="peringatan-box">${m.join('<br>')} <a href="#/pengaturan/ttd">Atur di Pengaturan</a></div>` : '';
    }
    infoTtd();

    $('#bSimpan').onclick = () => simpanSurat();
    const bA = $('#bAjukan'); if (bA) bA.onclick = ajukanSurat;
    const bT = $('#bTtd'); if (bT) bT.onclick = tandatanganiSurat;
    const bP = $('#bPdf'); if (bP) bP.onclick = () => unduhPdf(d);
    const bB = $('#bBatalEdit'); if (bB) bB.onclick = async () => { if (kotor && !(await konfirmasi('Selesai edit', 'Perubahan belum disimpan. Tinggalkan tanpa menyimpan?'))) return; kotor = false; bukaEditor({ id: d.id }); };
    window.addEventListener('resize', skalaPratinjau);
    renderPratinjau();
  }

  /* ---- editor kaya ---- */
  function pasangEditor(id, onInput) {
    const ed = $('#' + id); if (!ed) return;
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, false); } catch (e) { }
    const lapor = () => onInput(ed.innerHTML);
    ed.addEventListener('input', lapor);
    ed.addEventListener('paste', e => {
      e.preventDefault();
      const t = (e.clipboardData || window.clipboardData).getData('text/plain');
      const html = t.split(/\r?\n/).map(l => '<p>' + (esc(l) || '<br>') + '</p>').join('');
      document.execCommand('insertHTML', false, html);
    });
    $$(`.alat[data-ed="${id}"] button`).forEach(b => b.addEventListener('mousedown', e => {
      e.preventDefault();
      ed.focus();
      if (b.dataset.c) document.execCommand(b.dataset.c, false, null);
      if (b.dataset.k) {
        const sel = getSelection(); let n = sel.anchorNode; if (n && n.nodeType === 3) n = n.parentNode;
        let blk = n && n.closest ? n.closest('p,li') : null;
        if (!blk || !ed.contains(blk)) { document.execCommand('formatBlock', false, 'p'); n = getSelection().anchorNode; blk = n && (n.nodeType === 3 ? n.parentNode : n).closest('p'); }
        if (blk && blk.tagName === 'P') blk.classList.toggle(b.dataset.k);
      }
      if (b.dataset.t === 'detail') document.execCommand('insertHTML', false, '<table class="detail"><tbody><tr><td>Hari/Tanggal</td><td>: …</td></tr><tr><td>Waktu</td><td>: …</td></tr><tr><td>Tempat</td><td>: …</td></tr></tbody></table><p><br></p>');
      if (b.dataset.t === 'kotak') document.execCommand('insertHTML', false, '<table class="kotak"><tbody><tr><th>No</th><th>Uraian</th><th>Keterangan</th></tr><tr><td>1</td><td>…</td><td>…</td></tr><tr><td>2</td><td>…</td><td>…</td></tr></tbody></table><p><br></p>');
      lapor();
    }));
  }

  /* ---- daftar petugas (surat tugas) ---- */
  function pasangPetugas(ubah) {
    const dt = D.data;
    const gambarDaftar = () => {
      const ps = dt.petugas, n = ps.length, m = modePetugas(n);
      $('#infoMode').textContent = n ? `${n} orang · ditampilkan ${m === 'blok' ? 'per blok seperti contoh' : m === 'tabel' ? 'sebagai tabel di badan surat' : 'di halaman lampiran'}` : '';
      $('#daftarPetugas').innerHTML = n ? `<div class="petugas-list">${ps.map((x, i) => `<div class="ptg">
          <div class="no">${i + 1}.</div>
          <div><div class="nm">${esc(x.nama)} ${!ktaSah(x.kta) ? `<span class="lencana peringatan" title="${esc(ketKta(x.kta))}">cek KTA</span>` : ''}</div>
            <div class="dua"><input type="text" data-p="${i}" data-k="kta" value="${esc(x.kta)}" placeholder="No. KTA"><input type="text" data-p="${i}" data-k="jabatan" value="${esc(x.jabatan)}" placeholder="Jabatan"></div>
            ${!ktaSah(x.kta) && x.pid ? `<a href="#" data-perbaiki="${i}" style="font-size:12px">Perbaiki KTA di Data Pengurus</a>` : ''}
          </div>
          <div class="aksi"><button class="btn kecil" data-naik="${i}" title="Naik" ${i ? '' : 'disabled'}>↑</button><button class="btn kecil merah" data-hapus="${i}" title="Hapus">×</button></div>
        </div>`).join('')}</div>` : '<div class="petunjuk" style="margin:0">Belum ada yang ditugaskan.</div>';
      $$('[data-p]').forEach(el => el.oninput = () => { ps[+el.dataset.p][el.dataset.k] = el.value; ubah(); });
      $$('[data-hapus]').forEach(b => b.onclick = () => { ps.splice(+b.dataset.hapus, 1); gambarDaftar(); ubah(); });
      $$('[data-naik]').forEach(b => b.onclick = () => { const i = +b.dataset.naik; [ps[i - 1], ps[i]] = [ps[i], ps[i - 1]]; gambarDaftar(); ubah(); });
      $$('[data-perbaiki]').forEach(a => a.onclick = async e => {
        e.preventDefault(); const x = ps[+a.dataset.perbaiki]; const p = pengurusById(x.pid);
        if (p && await modalPengurus(p)) { const b = pengurusById(x.pid); if (b) { x.kta = b.kta; x.nama = b.nama; } gambarDaftar(); ubah(); }
      });
    };
    const tambah = p => { if (dt.petugas.some(x => x.pid && x.pid === p.id)) return toast(p.nama + ' sudah ada di daftar.'); dt.petugas.push({ pid: p.id, nama: p.nama, kta: p.kta, jabatan: p.jabatan }); };
    const cari = $('#cariPengurus'), hasil = $('#hasilCari');
    cari.oninput = () => {
      const q = cari.value.toLowerCase().trim();
      if (!q) { hasil.classList.add('tersembunyi'); return; }
      const l = S.pengurus.filter(x => aktif(x.aktif) && (x.nama + ' ' + x.jabatan + ' ' + x.kelompok).toLowerCase().includes(q)).slice(0, 12);
      hasil.innerHTML = l.length ? l.map(x => `<div data-id="${esc(x.id)}">${esc(x.nama)}<small>${esc(x.jabatan)} · KTA ${esc(x.kta)}</small></div>`).join('') : '<div style="cursor:default">Tidak ditemukan. Gunakan "+ Bukan pengurus".</div>';
      hasil.classList.remove('tersembunyi');
      $$('[data-id]', hasil).forEach(el => el.onmousedown = e => { e.preventDefault(); tambah(pengurusById(el.dataset.id)); cari.value = ''; hasil.classList.add('tersembunyi'); gambarDaftar(); ubah(); });
    };
    cari.onblur = () => setTimeout(() => hasil.classList.add('tersembunyi'), 150);
    $('#pilihKelompok').onchange = e => { const k = e.target.value; if (!k) return; S.pengurus.filter(x => aktif(x.aktif) && x.kelompok === k).forEach(tambah); e.target.value = ''; gambarDaftar(); ubah(); };
    $('#bManual').onclick = async () => {
      const r = await modal({ judul: 'Tambah petugas (bukan pengurus)', isi: `<label class="f"><span>Nama lengkap + gelar</span><input type="text" id="mN"></label><label class="f"><span>No. KTA</span><input type="text" id="mK"></label><label class="f"><span>Jabatan</span><input type="text" id="mJ"></label>`, tombol: [{ label: 'Batal' }, { label: 'Tambah', kelas: 'utama-b', aksi: l => { const n = $('#mN', l).value.trim(); if (!n) { toast('Nama wajib diisi.', 'galat'); return false; } return { pid: '', nama: n, kta: $('#mK', l).value.trim(), jabatan: $('#mJ', l).value.trim() }; } }] });
      if (r) { dt.petugas.push(r); gambarDaftar(); ubah(); }
    };
    gambarDaftar();
  }

  /* ---- pratinjau ---- */
  let tPrat = null;
  const jadwalkan = () => { clearTimeout(tPrat); tPrat = setTimeout(renderPratinjau, 200); };
  function renderPratinjau() {
    const el = $('#pratinjau'); if (!el || !D) return;
    el.innerHTML = renderHalaman(D).join('');
    skalaPratinjau();
    const cek = () => {
      const pg = $$('.pg', el), msg = [];
      pg.forEach((p, i) => { const h = $('.hal', p); const over = h.scrollHeight > h.clientHeight + 2; p.classList.toggle('terpotong', over); if (over) msg.push(`Isi halaman ${i + 1} melewati batas kertas — persingkat isi, pakai halaman lampiran, atau kurangi baris kosong.`); });
      if (D.jenis === 'tugas') (D.data.petugas || []).forEach(x => { if (!ktaSah(x.kta)) msg.push(`KTA ${esc(x.nama)}: ${esc(ketKta(x.kta))}.`); });
      $('#peringatan') && ($('#peringatan').innerHTML = msg.length ? `<div class="peringatan-box">${msg.join('<br>')}</div>` : '');
    };
    cek();
    siapGambar(el).then(cek);
  }
  function skalaPratinjau() {
    const b = $('#bingkai'), el = $('#pratinjau'); if (!b || !el) return;
    const s = (b.clientWidth - 28) / 816;
    el.style.transform = `scale(${s})`;
    const n = $$('.pg', el).length;
    el.style.height = '0px';
    b.style.height = (n * (1248 + 18) * s + 10) + 'px';
  }

  function paketSurat(d) {
    const dt = d.data, tugas = d.jenis === 'tugas';
    return { id: d.id, jenis: d.jenis, tanggal: d.tanggal, perihal: tugas ? 'Surat Tugas' : dt.perihal, ringkas: tugas ? dt.petugas.map(x => x.nama).join('; ') : baris(dt.tujuan).join('; '), data: dt };
  }
  function kekurangan(d) {
    const dt = d.data, tugas = d.jenis === 'tugas', k = [];
    if (!tglSah(d.tanggal)) k.push('Tanggal surat');
    if (!tugas && !String(dt.perihal || '').trim()) k.push('Perihal');
    if (!tugas && !baris(dt.tujuan).length) k.push('Tujuan surat');
    if (tugas && !dt.petugas.length) k.push('Yang ditugaskan');
    if (tugas && !baris(dt.untuk).length) k.push('Butir "Untuk"');
    if (!dt.ttd.nama) k.push('Penandatangan');
    return k;
  }
  const linkSurat = d => alamatPortal() + '#/surat/' + d.id;
  function setelahServer(it, view) {
    const mode = D && D.modeEdit;
    D = dariServer(it); kotor = false;
    if (location.hash !== '#/surat/' + D.id) { history.replaceState(null, '', '#/surat/' + D.id); hashSebelum = location.hash; }
    if (view === 'edit') { D.modeEdit = mode; viewEditor(); } else if (view === 'tinjau') viewTinjau();
  }
  async function simpanSurat() {
    if (!tglSah(D.tanggal)) return toast('Tanggal surat belum diisi.', 'galat');
    try { const r = await api('surat.simpan', { item: paketSurat(D) }); setelahServer(r.item, 'edit'); toast('Tersimpan.', 'sukses'); }
    catch (e) { toast(e.message, 'galat'); }
  }
  async function ajukanSurat() {
    const k = kekurangan(D); if (k.length) return toast('Lengkapi dulu: ' + k.join(', '), 'galat');
    if (!(await konfirmasi('Ajukan ke Ketua', 'Surat akan dikirim ke Ketua untuk diperiksa dan ditandatangani. Selama menunggu, surat tidak bisa diubah (kecuali ditarik kembali).', 'Ajukan'))) return;
    try {
      const r = await api('surat.ajukan', { item: paketSurat(D) });
      setelahServer(r.item, 'tinjau');
      const k1 = akunKetua();
      modalWa('Surat diajukan ✅', 'Surat sudah masuk ke daftar <b>Menunggu Tanda Tangan</b> Ketua. Kabari Ketua lewat WA:', k1,
        `Yth. ${(k1[0] || {}).nama || 'Ketua DPD PERSAGI Sulsel'},\nAda surat yang menunggu tanda tangan:\n*${D.data.perihal || 'Surat Tugas'}*\n${paketSurat(D).ringkas}\n\nPeriksa & tanda tangani di sini:\n${linkSurat(D)}`);
    } catch (e) { toast(e.message, 'galat'); }
  }
  async function tandatanganiSurat() {
    const k = kekurangan(D); if (k.length) return toast('Lengkapi dulu: ' + k.join(', '), 'galat');
    const dt = D.data;
    if (dt.ttd.pid !== S.user.pengurusId) return toast('Penandatangan surat ini bukan Anda (' + dt.ttd.nama + '). Ubah penandatangan, atau tautkan akun Anda di Pengaturan → Akun admin.', 'galat');
    if (dt.ttd.pakaiTtd && !S.gambar['ttd_' + dt.ttd.pid] && !(await konfirmasi('TTD belum diunggah', 'Gambar TTD Anda belum ada, surat akan terbit tanpa gambar tanda tangan. Lanjutkan?'))) return;
    const th = D.tanggal.slice(0, 4), t = D.tanggal.split('-');
    const no = (S.p.formatNomor || '{NO}/DPD-PERSAGI-SULSEL/{BLN}/{THN}').replace('{NO}', String((S.penomoran[th] || 0) + 1).padStart(+S.p.digitNomor || 3, '0')).replace('{BLN}', ROMAWI[+t[1] - 1]).replace('{THN}', th);
    if (!(await konfirmasi('Tanda tangani surat', `Dengan menekan <b>Tanda Tangani</b>, Anda menyetujui isi surat ini.<br><br>Nomor surat: <b class="mono">${esc(no)}</b> <small>(dipastikan server agar tidak dobel)</small><br>TTD ${dt.ttd.pakaiStempel ? 'dan stempel ' : ''}akan dibubuhkan, lalu PDF final disimpan ke arsip.`, '✍️ Tanda Tangani', 'kuning'))) return;
    try {
      const r = await api('surat.tandatangani', { item: paketSurat(D) });
      S.penomoran = r.penomoran || S.penomoran;
      D.modeEdit = false;
      setelahServer(r.item, 'tinjau');
      const ok = await arsipkanPdf(D);
      viewTinjau();
      const sek = akunSekretaris();
      modalWa('Surat ditandatangani ✍️', `Nomor surat: <b class="mono">${esc(D.nomor)}</b>${ok ? '<br>PDF final sudah tersimpan di arsip.' : ''}<br><br>Kabari sekretaris agar surat segera dikirim:`, sek,
        `Surat *${D.data.perihal || 'Surat Tugas'}* sudah ditandatangani.\nNomor: ${D.nomor}\n\nSilakan unduh PDF final lalu kirim ke yang bersangkutan:\n${linkSurat(D)}`);
    } catch (e) { toast(e.message, 'galat'); }
  }
  async function kembalikanSurat() {
    const c = await modal({ judul: 'Kembalikan ke sekretaris', isi: `<label class="f"><span>Catatan perbaikan</span><textarea id="kC" rows="4" placeholder="Mis. tanggal kegiatan salah, tambahkan nama petugas…"></textarea></label>`, tombol: [{ label: 'Batal' }, { label: '↩ Kembalikan', kelas: 'utama-b', aksi: l => { const v = $('#kC', l).value.trim(); if (!v) { toast('Tuliskan catatannya.', 'galat'); return false; } return v; } }] });
    if (!c) return;
    try {
      const r = await api('surat.kembalikan', { id: D.id, catatan: c });
      setelahServer(r.item, 'tinjau');
      modalWa('Surat dikembalikan', 'Kabari sekretaris agar segera diperbaiki:', akunSekretaris(), `Surat *${D.data.perihal || 'Surat Tugas'}* dikembalikan untuk diperbaiki.\nCatatan: ${c}\n\n${linkSurat(D)}`);
    } catch (e) { toast(e.message, 'galat'); }
  }
  async function tarikSurat() {
    if (!(await konfirmasi('Tarik kembali', 'Surat ditarik dari Ketua dan kembali menjadi draf agar bisa diubah. Setelah diperbaiki, ajukan lagi.', 'Tarik kembali'))) return;
    try { const r = await api('surat.tarik', { id: D.id }); setelahServer(r.item, 'edit'); } catch (e) { toast(e.message, 'galat'); }
  }
  async function tandaiTerkirim() {
    const r0 = await modal({ judul: 'Tandai surat terkirim', isi: `<div class="dua"><label class="f"><span>Tanggal kirim</span><input type="date" id="tT" value="${hariIni()}"></label><label class="f"><span>Dikirim lewat</span><select id="tV"><option>WhatsApp</option><option>Email</option><option>Diantar langsung</option><option>Pos / ekspedisi</option><option>Lainnya</option></select></label></div><label class="f"><span>Keterangan <i>(opsional)</i></span><input type="text" id="tK" placeholder="Mis. dikirim ke WA sekretaris RSUD"></label>`, tombol: [{ label: 'Batal' }, { label: '📤 Simpan', kelas: 'utama-b', aksi: l => ({ tanggal: $('#tT', l).value, via: $('#tV', l).value, ket: $('#tK', l).value }) }] });
    if (!r0) return;
    try { const r = await api('surat.terkirim', Object.assign({ id: D.id }, r0)); setelahServer(r.item, 'tinjau'); toast('Surat ditandai terkirim.', 'sukses'); } catch (e) { toast(e.message, 'galat'); }
  }

  /* ---- Mode tinjau: untuk surat yang diajukan / sudah ditandatangani (ramah HP) ---- */
  function viewTinjau() {
    const d = D, j = JENIS[d.jenis] || JENIS.umum, ketua = isKetua(), st = d.status;
    const kirim = d.kirim || null;
    let aksi = '', info = '', lain = '';
    if (st === 'diajukan') {
      info = ketua ? 'Surat ini diajukan sekretaris dan menunggu tanda tangan Anda. Periksa isinya pada pratinjau.' : 'Menunggu pemeriksaan dan tanda tangan Ketua.';
      aksi = ketua
        ? `<button class="btn kuning besar" id="tTtd">✍️ Setujui & Tanda Tangani</button><button class="btn" id="tEdit">✏️ Edit dulu</button><button class="btn merah" id="tKembali">↩ Kembalikan</button>`
        : `<button class="btn wa" id="tIngat">💬 Ingatkan Ketua via WA</button><button class="btn" id="tTarik">↶ Tarik kembali ke draf</button>`;
    } else if (st === 'ditandatangani' || st === 'terbit') {
      info = 'Surat sudah ditandatangani' + (d.ttdOleh ? ' oleh <b>' + esc(d.ttdOleh) + '</b>' : '') + (d.ttdPada ? ' pada ' + esc(String(d.ttdPada).replace('T', ' ').slice(0, 16)) : '') + '. Silakan unduh PDF final dan kirim ke tujuan.';
      aksi = `<button class="btn utama-b besar" id="tUnduh">⬇ Unduh PDF final</button><button class="btn kuning" id="tKirim">📤 Tandai terkirim</button>` +
        (ketua ? `<button class="btn wa" id="tKabari">💬 Kabari sekretaris</button>` : '');
      lain = ketua ? `<button class="btn" id="tCetak">🖨 Cetak</button><button class="btn" id="tUlang">↻ Simpan ulang PDF</button><button class="btn merah" id="tBatal">Batalkan surat</button>` : '';
    } else if (st === 'terkirim') {
      info = 'Surat sudah dikirim' + (kirim ? ` lewat <b>${esc(kirim.via)}</b> pada ${fmtTgl(kirim.tanggal)}${kirim.ket ? ' — ' + esc(kirim.ket) : ''}` : '') + '.';
      aksi = `<button class="btn utama-b besar" id="tUnduh">⬇ Unduh PDF final</button>`;
      lain = ketua ? `<button class="btn" id="tCetak">🖨 Cetak</button><button class="btn merah" id="tBatal">Batalkan surat</button>` : '';
    } else if (st === 'batal') {
      info = 'Surat ini telah <b>dibatalkan</b>. Nomornya tetap tercatat dan tidak dipakai ulang.';
    }
    kerangka('surat', `
      <div class="judul-hal"><div><h2>${j.ikon} ${esc(d.data.perihal && d.jenis !== 'tugas' ? d.data.perihal : j.label)}</h2><p>${lencanaStatus(st)} ${d.nomor ? '· <b class="mono">' + esc(d.nomor) + '</b>' : ''}</p></div><a class="btn" href="#/surat">← Daftar surat</a></div>
      <div class="tinjau-layout">
        <div class="panel-pratinjau"><div id="peringatan"></div><div class="pratinjau-bingkai" id="bingkai"><div class="pratinjau-skala" id="pratinjau"></div></div></div>
        <div>
          <div class="kartu"><h3>Status <button class="btn kecil hanya-hp" id="tLihat">📄 Lihat isi surat</button></h3><div style="line-height:1.6">${info}</div>
            ${d.catatan && st !== 'ditandatangani' ? `<div class="peringatan-box" style="margin-top:10px">Catatan Ketua: ${esc(d.catatan)}</div>` : ''}
            ${aksi ? `<div class="aksi-tinjau">${aksi}</div>` : ''}
            ${lain ? `<div class="deret" style="margin-top:10px">${lain}</div>` : ''}
          </div>
          <div class="kartu"><h3>Ringkasan</h3><table class="tb"><tbody>
            <tr><td style="color:var(--abu)">Jenis</td><td>${esc(j.label)}</td></tr>
            <tr><td style="color:var(--abu)">Tanggal</td><td>${fmtTgl(d.tanggal)}</td></tr>
            <tr><td style="color:var(--abu)">${d.jenis === 'tugas' ? 'Petugas' : 'Tujuan'}</td><td>${esc(paketSurat(d).ringkas)}</td></tr>
            <tr><td style="color:var(--abu)">Penandatangan</td><td>${esc(d.data.ttd.nama)}</td></tr>
          </tbody></table>
          <div class="deret" style="margin-top:10px"><a class="btn kecil" href="#/surat/salin/${esc(d.id)}">⧉ Salin jadi surat baru</a></div></div>
          ${(d.riwayat || []).length ? `<div class="kartu"><h3>Riwayat</h3><div class="riwayat">${d.riwayat.slice().reverse().map(x => `<div><b>${esc(x.aksi)}</b> — ${esc(x.oleh)}<br><small>${esc(String(x.waktu).replace('T', ' ').slice(0, 16))}${x.catatan ? ' · ' + esc(x.catatan) : ''}</small></div>`).join('')}</div></div>` : ''}
        </div>
      </div>`);
    const on = (id, fn) => { const b = $('#' + id); if (b) b.onclick = fn; };
    on('tLihat', () => $('#bingkai').scrollIntoView({ behavior: 'smooth' }));
    on('tTtd', tandatanganiSurat);
    on('tEdit', () => { D.modeEdit = true; viewEditor(); });
    on('tKembali', kembalikanSurat);
    on('tTarik', tarikSurat);
    on('tIngat', () => { const k1 = akunKetua(); modalWa('Ingatkan Ketua', 'Kirim pengingat ke Ketua:', k1, `Yth. ${(k1[0] || {}).nama || 'Ketua'},\nMohon berkenan memeriksa & menandatangani surat:\n*${d.data.perihal || 'Surat Tugas'}*\n${linkSurat(d)}`); });
    on('tUnduh', () => unduhFinal(d));
    on('tKirim', tandaiTerkirim);
    on('tKabari', () => modalWa('Kabari sekretaris', 'Kirim pemberitahuan ke sekretaris:', akunSekretaris(), `Surat *${d.data.perihal || 'Surat Tugas'}* sudah ditandatangani.\nNomor: ${d.nomor}\n\nSilakan unduh PDF final lalu kirim:\n${linkSurat(d)}`));
    on('tCetak', () => cetak(d));
    on('tUlang', async () => { if (await arsipkanPdf(d)) toast('PDF final disimpan ulang.', 'sukses'); });
    on('tBatal', async () => { if (await batalSurat(d.id, st)) bukaEditor({ id: d.id }); });
    window.addEventListener('resize', skalaPratinjau);
    renderPratinjau();
  }

  /* ================= DATA PENGURUS ================= */
  function viewPengurus() {
    const q = new URLSearchParams((location.hash.split('?')[1]) || '');
    const kel = [...new Set(S.pengurus.map(x => x.kelompok).filter(Boolean))];
    kerangka('pengurus', `
      <div class="judul-hal"><div><h2>Data Pengurus</h2><p>Susunan & KTA Pengurus DPD PERSAGI Sulawesi Selatan periode 2026–2031. Dipakai otomatis di surat.</p></div><button class="btn utama-b" id="bTambahP">+ Tambah pengurus</button></div>
      <div class="kartu">
        <div class="saring">
          <input type="text" id="pCari" placeholder="Cari nama, jabatan, KTA…">
          <select id="pKel"><option value="">Semua kelompok</option>${kel.map(k => `<option>${esc(k)}</option>`).join('')}</select>
          <label class="cek" style="margin:0"><input type="checkbox" id="pCek" ${q.get('cek') ? 'checked' : ''}> KTA perlu dicek</label>
          <label class="cek" style="margin:0"><input type="checkbox" id="pNon"> Tampilkan nonaktif</label>
        </div>
        <div id="tPengurus"></div>
      </div>`);
    const g = () => {
      const c = $('#pCari').value.toLowerCase(), k = $('#pKel').value, ck = $('#pCek').checked, nn = $('#pNon').checked;
      const l = S.pengurus.filter(x => (nn || aktif(x.aktif)) && (!k || x.kelompok === k) && (!ck || !ktaSah(x.kta)) && (!c || [x.nama, x.jabatan, x.kta, x.kelompok].join(' ').toLowerCase().includes(c)));
      $('#tPengurus').innerHTML = `<p class="petunjuk" style="margin:0 0 8px">${l.length} orang</p>` + (l.length ? `<div class="tabel-wrap"><table class="tb"><thead><tr><th>#</th><th>Nama</th><th>Jabatan</th><th>No. KTA</th><th>Kontak</th><th></th></tr></thead><tbody>${l.map((x, i) => `<tr class="${aktif(x.aktif) ? '' : 'nonaktif'}">
        <td>${i + 1}</td><td><b>${esc(x.nama)}</b>${x.catatan ? `<br><small style="color:var(--abu)">${esc(x.catatan)}</small>` : ''}</td>
        <td>${esc(x.jabatan)}<br><small style="color:var(--abu)">${esc(x.kelompok)}</small></td>
        <td><span class="mono">${esc(x.kta)}</span>${ktaSah(x.kta) ? '' : `<br><span class="lencana peringatan">${esc(ketKta(x.kta))}</span>`}</td>
        <td style="font-size:12px">${esc(x.hp)}${x.hp && x.email ? '<br>' : ''}${esc(x.email)}</td>
        <td><button class="btn kecil" data-ed="${esc(x.id)}">Edit</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="kosong">Tidak ada data.</div>');
      $$('[data-ed]', $('#tPengurus')).forEach(b => b.onclick = async () => { if (await modalPengurus(pengurusById(b.dataset.ed))) g(); });
    };
    ['pCari'].forEach(i => $('#' + i).oninput = g);
    ['pKel', 'pCek', 'pNon'].forEach(i => $('#' + i).onchange = g);
    $('#bTambahP').onclick = async () => { if (await modalPengurus(null)) g(); };
    g();
  }
  function modalPengurus(p) {
    const x = p || { nama: '', jabatan: '', kelompok: '', kta: '', hp: '', email: '', aktif: true, catatan: '' };
    const kel = [...new Set(S.pengurus.map(y => y.kelompok).filter(Boolean))];
    return modal({
      judul: p ? 'Edit pengurus' : 'Tambah pengurus',
      isi: `<datalist id="dlKel">${kel.map(k => `<option value="${esc(k)}">`).join('')}</datalist>
        <label class="f"><span>Nama lengkap + gelar</span><input type="text" id="pN" value="${esc(x.nama)}"></label>
        <div class="dua"><label class="f"><span>Jabatan</span><input type="text" id="pJ" value="${esc(x.jabatan)}"></label><label class="f"><span>Kelompok / bidang</span><input type="text" id="pK" list="dlKel" value="${esc(x.kelompok)}"></label></div>
        <label class="f"><span>No. KTA <i id="pKtaInfo"></i></span><input type="text" id="pKta" class="mono" value="${esc(x.kta)}" inputmode="numeric"></label>
        <div class="dua"><label class="f"><span>No. HP/WA <i>(opsional)</i></span><input type="text" id="pH" value="${esc(x.hp)}"></label><label class="f"><span>Email <i>(opsional)</i></span><input type="email" id="pE" value="${esc(x.email)}"></label></div>
        <label class="f"><span>Catatan <i>(opsional)</i></span><input type="text" id="pC" value="${esc(x.catatan)}"></label>
        <label class="cek"><input type="checkbox" id="pA" ${aktif(x.aktif) ? 'checked' : ''}> Aktif</label>
        <p class="petunjuk" style="margin:6px 0 0">KTA tetap bisa disimpan walau belum 17 digit — hanya diberi tanda "cek KTA". Surat yang sudah terbit tidak ikut berubah.</p>`,
      tombol: [
        ...(p ? [{ label: 'Hapus', kelas: 'merah', aksi: async () => { if (!(await konfirmasi('Hapus pengurus', `Hapus <b>${esc(x.nama)}</b> dari data? Lebih aman dinonaktifkan saja.`, 'Hapus', 'merah'))) return false; try { const r = await api('pengurus.hapus', { id: x.id }); S.pengurus = r.pengurus; toast('Dihapus.', 'sukses'); return true; } catch (e) { toast(e.message, 'galat'); return false; } } }] : []),
        { label: 'Batal', nilai: false },
        {
          label: 'Simpan', kelas: 'utama-b', aksi: async l => {
            const item = { id: x.id, nama: $('#pN', l).value.trim(), jabatan: $('#pJ', l).value.trim(), kelompok: $('#pK', l).value.trim(), kta: $('#pKta', l).value.trim(), hp: $('#pH', l).value.trim(), email: $('#pE', l).value.trim(), catatan: $('#pC', l).value.trim(), aktif: $('#pA', l).checked };
            if (!item.nama) { toast('Nama wajib diisi.', 'galat'); return false; }
            try { const r = await api('pengurus.simpan', { item }); S.pengurus = r.pengurus; toast('Data pengurus tersimpan.' + (ktaSah(item.kta) ? '' : ' (KTA masih perlu dicek)'), 'sukses'); return true; }
            catch (e) { toast(e.message, 'galat'); return false; }
          }
        }]
    });
  }
  document.addEventListener('input', e => {
    if (e.target.id === 'pKta') { const v = e.target.value; const i = $('#pKtaInfo'); if (i) { i.textContent = ktaSah(v) ? '✓ 17 digit' : '⚠ ' + ketKta(v); i.style.color = ktaSah(v) ? 'var(--hijau)' : 'var(--oranye)'; } }
  });

  /* ================= PENGATURAN ================= */
  const TAB_SEMUA = [['ttd', 'TTD & Stempel'], ['kop', 'Kop & Footer'], ['nomor', 'Penomoran'], ['tampilan', 'Tampilan surat'], ['integrasi', 'Integrasi'], ['akun', 'Akun'], ['log', 'Log aktivitas']];
  function viewPengaturan(tab) {
    kerangka('pengaturan', `
      <div class="judul-hal"><div><h2>Pengaturan</h2><p>Berlaku untuk semua surat yang dibuat setelah disimpan.</p></div><button class="btn" id="bGantiPw">🔑 Ganti password saya</button></div>
      <div class="tab">${TAB_SEMUA.filter(t => isKetua() || !['ttd', 'akun'].includes(t[0])).map(([k, l]) => `<button class="${k === tab ? 'aktif' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="isiTab"></div>`);
    $$('[data-tab]').forEach(b => b.onclick = () => { location.hash = '#/pengaturan/' + b.dataset.tab; });
    $('#bGantiPw').onclick = () => modalGantiPassword(false);
    if (!isKetua() && ['ttd', 'akun'].includes(tab)) tab = 'kop';
    ({ ttd: tabTtd, kop: tabKop, nomor: tabNomor, tampilan: tabTampilan, integrasi: tabIntegrasi, akun: tabAkun, log: tabLog }[tab] || tabTtd)();
  }
  async function simpanPengaturan(data, pesan = 'Pengaturan tersimpan.') {
    try { const r = await api('pengaturan.simpan', { data }); S.p = r.pengaturan; toast(pesan, 'sukses'); return true; } catch (e) { toast(e.message, 'galat'); return false; }
  }
  function prosesGambar(file, { maxW = 1200, hapusPutih = false } = {}) {
    return new Promise((res, rej) => {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return rej(new Error('Pilih file gambar PNG/JPG.'));
      const fr = new FileReader();
      fr.onload = () => {
        const im = new Image();
        im.onload = () => {
          const s = Math.min(1, maxW / im.width), c = document.createElement('canvas');
          c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
          const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
          const d0 = x.getImageData(0, 0, c.width, c.height).data;
          let adaTransparan = false; for (let i = 3; i < d0.length; i += 16) if (d0[i] < 250) { adaTransparan = true; break; }
          if (hapusPutih && !adaTransparan) {
            const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
            for (let i = 0; i < a.length; i += 4) { const m = Math.min(a[i], a[i + 1], a[i + 2]); if (m > 215) a[i + 3] = 0; else if (m > 170) a[i + 3] = Math.round(a[i + 3] * (215 - m) / 45); }
            x.putImageData(d, 0, 0);
          }
          res(c.toDataURL('image/png'));
        };
        im.onerror = () => rej(new Error('Gambar tidak dapat dibaca.'));
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  async function unggahGambar(nama, file, opsi) {
    try { const dataUrl = await prosesGambar(file, opsi); const r = await api('gambar.simpan', { nama, dataUrl }); S.gambar = r.gambar; toast('Gambar tersimpan.', 'sukses'); return true; }
    catch (e) { toast(e.message, 'galat'); return false; }
  }
  async function hapusGambar(nama) {
    if (!(await konfirmasi('Hapus gambar', 'Hapus gambar ini?', 'Hapus', 'merah'))) return false;
    try { const r = await api('gambar.hapus', { nama }); S.gambar = r.gambar; toast('Gambar dihapus.', 'sukses'); return true; } catch (e) { toast(e.message, 'galat'); return false; }
  }

  function tabTtd() {
    const p = S.p;
    if (!S.user.pengurusId) { $('#isiTab').innerHTML = '<div class="kartu"><div class="peringatan-box">Akun Anda belum ditautkan ke data pengurus. Buka tab <a href="#/pengaturan/akun">Akun</a>, edit akun Anda, lalu pilih nama Anda di "Tautkan ke pengurus".</div></div>'; return; }
    const ops = S.pengurus.filter(x => aktif(x.aktif) && x.id === S.user.pengurusId);
    const sel = ops[0] || {};
    const geser = (k, l, min, max, st) => `<div class="geser"><span>${l}</span><input type="range" data-g="${k}" min="${min}" max="${max}" step="${st}" value="${esc(p[k])}"><span class="mono" data-gv="${k}">${esc(p[k])}</span></div>`;
    $('#isiTab').innerHTML = `
      <div class="surat-layout" style="grid-template-columns:minmax(340px,560px) 1fr">
      <div>
        <div class="kartu"><h3>Penandatangan bawaan</h3>
          <label class="f"><span>Nama</span><select id="sPenanda">${ops.map(x => `<option value="${esc(x.id)}" ${x.id === sel.id ? 'selected' : ''}>${esc(x.nama)} — ${esc(x.jabatan)}</option>`).join('')}</select></label>
          <label class="f"><span>Baris jabatan di atas tanda tangan</span><textarea id="sBaris" rows="4">${esc(p.ttdBaris)}</textarea></label>
          <div class="dua"><label class="f"><span>Kota</span><input type="text" id="sKota" value="${esc(p.kota)}"></label><label class="f"><span>Label KTA</span><input type="text" id="sLabel" value="${esc(p.labelKta)}"></label></div>
          <button class="btn utama-b" id="bSimpanPenanda">Simpan</button>
        </div>
        <div class="kartu"><h3>Gambar tanda tangan <small>per penandatangan</small></h3>
          <label class="f"><span>Untuk</span><select id="sTtdUntuk">${ops.map(x => `<option value="${esc(x.id)}" ${x.id === sel.id ? 'selected' : ''}>${esc(x.nama)}${S.gambar['ttd_' + x.id] ? ' ✓' : ''}</option>`).join('')}</select></label>
          <div class="gbr-kotak" id="boxTtd"></div>
          <label class="cek" style="margin-top:10px"><input type="checkbox" id="sPutih" checked> Hapus latar putih otomatis (untuk foto/scan TTD di kertas; dilewati bila PNG sudah transparan)</label>
          <div class="deret"><label class="btn utama-b">⬆ Unggah TTD<input type="file" id="fTtd" accept="image/png,image/jpeg,image/webp" hidden></label><button class="btn merah" id="bHapusTtd">Hapus</button></div>
        </div>
        <div class="kartu"><h3>Stempel</h3>
          <div class="gbr-kotak" id="boxStp"></div>
          <label class="cek" style="margin-top:10px"><input type="checkbox" id="sPutihS" checked> Hapus latar putih otomatis</label>
          <div class="deret"><label class="btn utama-b">⬆ Unggah stempel<input type="file" id="fStp" accept="image/png,image/jpeg,image/webp" hidden></label><button class="btn merah" id="bHapusStp">Hapus</button></div>
          <p class="petunjuk" style="margin:10px 0 0">Saran: PNG berlatar transparan. Gambar TTD dan stempel disimpan di Google Drive milik portal (tidak di GitHub), dan hanya terbaca setelah login.</p>
        </div>
      </div>
      <div>
        <div class="kartu"><h3>Posisi & ukuran <small>dalam inci</small></h3>
          <b style="font-size:12.5px">Tanda tangan</b>
          ${geser('ttdLebar', 'Lebar', 0.8, 3, 0.05)}${geser('ttdX', 'Geser kiri–kanan', -1.5, 1.5, 0.02)}${geser('ttdY', 'Geser bawah–atas', -0.3, 1.5, 0.02)}
          <b style="font-size:12.5px;display:block;margin-top:8px">Stempel</b>
          ${geser('stempelLebar', 'Lebar', 0.6, 2, 0.02)}${geser('stempelX', 'Geser kiri–kanan', -1.8, 1.5, 0.02)}${geser('stempelY', 'Geser bawah–atas', -0.5, 1.5, 0.02)}${geser('stempelOpasitas', 'Ketebalan', 0.3, 1, 0.05)}
          <div class="deret" style="margin:10px 0"><button class="btn utama-b" id="bSimpanPos">Simpan posisi</button><button class="btn" id="bResetPos">Kembalikan bawaan</button></div>
          <div class="pratinjau-ttd" id="prTtd"></div>
        </div>
      </div></div>`;
    const prev = () => {
      const pid = $('#sTtdUntuk').value;
      $('#boxTtd').innerHTML = S.gambar['ttd_' + pid] ? `<img src="${S.gambar['ttd_' + pid]}" alt="">` : '<span style="color:var(--abu)">Belum ada TTD</span>';
      $('#boxStp').innerHTML = S.gambar.stempel ? `<img src="${S.gambar.stempel}" alt="">` : '<span style="color:var(--abu)">Belum ada stempel</span>';
      const pp = pengurusById(pid) || {};
      const contoh = { tanggal: hariIni(), data: { ttd: { pid, nama: pp.nama, kta: pp.kta, baris: $('#sBaris').value, pakaiTtd: true, pakaiStempel: true } } };
      const s = Math.min(1, ($('#prTtd').clientWidth - 20) / 432);
      $('#prTtd').innerHTML = `<div style="transform:scale(${s});transform-origin:0 0;width:432px;height:${290 * s}px"><div class="pg" style="${varGaya()}width:4.5in;height:3in;"><div class="hal" style="top:.15in;left:.1in;right:.1in;bottom:.1in"><div style="margin-left:1.2in">${htmlTtd(contoh, true).replace('class="ttd"', 'class="ttd" style="margin:0"')}</div></div></div></div>`;
    };
    $('#sTtdUntuk').onchange = prev; $('#sBaris').oninput = prev;
    $$('[data-g]').forEach(r => r.oninput = () => { S.p[r.dataset.g] = r.value; $(`[data-gv="${r.dataset.g}"]`).textContent = r.value; prev(); });
    $('#bSimpanPenanda').onclick = () => simpanPengaturan({ penandatanganId: $('#sPenanda').value, ttdBaris: $('#sBaris').value, kota: $('#sKota').value, labelKta: $('#sLabel').value });
    $('#bSimpanPos').onclick = () => { const o = {}; ['ttdLebar', 'ttdX', 'ttdY', 'stempelLebar', 'stempelX', 'stempelY', 'stempelOpasitas'].forEach(k => o[k] = S.p[k]); simpanPengaturan(o, 'Posisi TTD & stempel tersimpan.'); };
    $('#bResetPos').onclick = () => { Object.assign(S.p, BAWAAN_POSISI); tabTtd(); };
    $('#fTtd').onchange = async e => { const f = e.target.files[0]; if (f && await unggahGambar('ttd_' + $('#sTtdUntuk').value, f, { maxW: 900, hapusPutih: $('#sPutih').checked })) { const v = $('#sTtdUntuk').value; tabTtd(); $('#sTtdUntuk').value = v; $('#sTtdUntuk').onchange(); } };
    $('#fStp').onchange = async e => { const f = e.target.files[0]; if (f && await unggahGambar('stempel', f, { maxW: 700, hapusPutih: $('#sPutihS').checked })) tabTtd(); };
    $('#bHapusTtd').onclick = async () => { const v = $('#sTtdUntuk').value; if (await hapusGambar('ttd_' + v)) { tabTtd(); $('#sTtdUntuk').value = v; prev(); } };
    $('#bHapusStp').onclick = async () => { if (await hapusGambar('stempel')) tabTtd(); };
    prev();
  }
  const BAWAAN_POSISI = { ttdLebar: '2.1', ttdX: '-0.3', ttdY: '0.35', stempelLebar: '1.07', stempelX: '-0.55', stempelY: '0.2', stempelOpasitas: '0.85' };

  function tabKop() {
    $('#isiTab').innerHTML = `
      <div class="kartu"><h3>Kop surat <small>${S.gambar.kop ? 'kop unggahan' : 'kop bawaan (dari contoh surat)'}</small></h3>
        <div class="gbr-kotak"><img src="${kopSrc()}" alt="" style="max-height:120px"></div>
        <div class="deret" style="margin-top:10px"><label class="btn utama-b">⬆ Ganti kop<input type="file" id="fKop" accept="image/png,image/jpeg" hidden></label>${S.gambar.kop ? '<button class="btn" id="bResetKop">Kembalikan kop bawaan</button>' : ''}</div>
        <p class="petunjuk" style="margin:10px 0 0">Gambar kop selebar 7,17 inci (logo, tulisan, dan garis ganda), latar putih/transparan. Resolusi disarankan ±2150 piksel lebar.</p>
      </div>
      <div class="kartu"><h3>Footer <small>${S.gambar.footer ? 'footer unggahan' : 'footer bawaan'}</small></h3>
        <div class="gbr-kotak"><img src="${footerSrc()}" alt=""></div>
        <div class="deret" style="margin-top:10px"><label class="btn utama-b">⬆ Ganti footer<input type="file" id="fFoot" accept="image/png,image/jpeg" hidden></label>${S.gambar.footer ? '<button class="btn" id="bResetFoot">Kembalikan footer bawaan</button>' : ''}</div>
        <p class="petunjuk" style="margin:10px 0 0">Footer dipasang selebar kertas (8,5 inci) di dasar setiap halaman.</p>
      </div>`;
    $('#fKop').onchange = async e => { const f = e.target.files[0]; if (f && await unggahGambar('kop', f, { maxW: 2400 })) tabKop(); };
    $('#fFoot').onchange = async e => { const f = e.target.files[0]; if (f && await unggahGambar('footer', f, { maxW: 2400 })) tabKop(); };
    const rk = $('#bResetKop'); if (rk) rk.onclick = async () => { if (await hapusGambar('kop')) tabKop(); };
    const rf = $('#bResetFoot'); if (rf) rf.onclick = async () => { if (await hapusGambar('footer')) tabKop(); };
  }

  function tabNomor() {
    const p = S.p, th = new Date().getFullYear();
    const ths = [...new Set([th, ...Object.keys(S.penomoran).map(Number)])].sort((a, b) => b - a);
    $('#isiTab').innerHTML = `
      <div class="kartu"><h3>Format nomor surat</h3>
        <label class="f"><span>Format <i>{NO} = nomor urut, {BLN} = bulan Romawi, {THN} = tahun</i></span><input type="text" id="nFmt" class="mono" value="${esc(p.formatNomor)}"></label>
        <div class="dua"><label class="f"><span>Jumlah digit nomor urut</span><input type="number" id="nDig" min="1" max="6" value="${esc(p.digitNomor)}"></label><label class="f"><span>Contoh</span><input type="text" id="nCth" class="mono" disabled></label></div>
        <p class="petunjuk">Nomor urut berlanjut sepanjang tahun dan mulai lagi dari 001 di tahun berikutnya. Bulan Romawi mengikuti tanggal surat.</p>
        <button class="btn utama-b" id="bSimpanFmt">Simpan format</button>
      </div>
      <div class="kartu"><h3>Nomor terakhir per tahun</h3>
        <div class="tabel-wrap"><table class="tb"><thead><tr><th>Tahun</th><th>Nomor terakhir</th><th>Nomor berikutnya</th><th></th></tr></thead><tbody>
        ${ths.map(t => `<tr><td>${t}</td><td class="mono">${String(S.penomoran[t] || 0).padStart(+p.digitNomor || 3, '0')}</td><td class="mono">${String((S.penomoran[t] || 0) + 1).padStart(+p.digitNomor || 3, '0')}</td><td>${isKetua() ? `<button class="btn kecil" data-th="${t}">Ubah</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="petunjuk" style="margin:10px 0 0">Ubah hanya bila ada surat yang dinomori di luar portal (mis. surat manual). Nomor tidak boleh mundur di bawah nomor yang sudah terbit.</p>
      </div>`;
    const cth = () => { const d = +$('#nDig').value || 3; $('#nCth').value = $('#nFmt').value.replace('{NO}', String((S.penomoran[th] || 0) + 1).padStart(d, '0')).replace('{BLN}', ROMAWI[new Date().getMonth()]).replace('{THN}', th); };
    $('#nFmt').oninput = cth; $('#nDig').oninput = cth; cth();
    $('#bSimpanFmt').onclick = () => { const v = $('#nFmt').value; if (!v.includes('{NO}')) return toast('Format wajib memuat {NO}.', 'galat'); simpanPengaturan({ formatNomor: v, digitNomor: $('#nDig').value }); };
    $$('[data-th]').forEach(b => b.onclick = async () => {
      const t = b.dataset.th;
      const v = await modal({ judul: 'Nomor terakhir tahun ' + t, isi: `<label class="f"><span>Nomor surat terakhir yang sudah terpakai</span><input type="number" id="nT" min="0" value="${S.penomoran[t] || 0}"></label>`, tombol: [{ label: 'Batal' }, { label: 'Simpan', kelas: 'utama-b', aksi: l => $('#nT', l).value }] });
      if (v === null || v === undefined) return;
      try { const r = await api('penomoran.set', { tahun: t, terakhir: v }); S.penomoran = r.penomoran; toast('Nomor terakhir diperbarui.', 'sukses'); tabNomor(); } catch (e) { toast(e.message, 'galat'); }
    });
  }

  function tabTampilan() {
    const p = S.p, F = ['Cambria', 'Arial', 'Times New Roman', 'Calibri', 'Bookman Old Style'];
    const pf = (id, v) => `<select id="${id}">${F.map(f => `<option ${f === v ? 'selected' : ''}>${f}</option>`).join('')}</select>`;
    const ps = (id, v) => `<input type="number" id="${id}" min="9" max="14" step="0.5" value="${esc(v)}">`;
    $('#isiTab').innerHTML = `
      <div class="kartu"><h3>Huruf</h3>
        <div class="dua"><label class="f"><span>Surat biasa (undangan, permohonan, dll.)</span>${pf('tFi', p.fontIsi)}</label><label class="f"><span>Ukuran (pt)</span>${ps('tSi', p.ukuranIsi)}</label></div>
        <div class="dua"><label class="f"><span>Surat tugas & lampiran</span>${pf('tFt', p.fontTugas)}</label><label class="f"><span>Ukuran (pt)</span>${ps('tSt', p.ukuranTugas)}</label></div>
        <div class="dua"><label class="f"><span>Blok tanda tangan</span>${pf('tFd', p.fontTtd)}</label><label class="f"><span>Ukuran (pt)</span>${ps('tSd', p.ukuranTtd)}</label></div>
        <p class="petunjuk">Bawaan mengikuti contoh surat: isi Cambria 12, surat tugas & tanda tangan Arial 12. Bila Cambria/Arial tidak terpasang (mis. di HP), dipakai huruf pengganti berukuran sama (Caladea/Arimo).</p>
      </div>
      <div class="kartu"><h3>Lain-lain</h3>
        <div class="tiga"><label class="f"><span>Zona waktu</span><select id="tZona">${['WITA', 'WIB', 'WIT'].map(z => `<option ${z === p.zonaWaktu ? 'selected' : ''}>${z}</option>`).join('')}</select></label>
        <label class="f"><span>Petugas per blok s.d.</span><input type="number" id="tBb" min="1" max="10" value="${esc(p.batasBlokPetugas)}"></label>
        <label class="f"><span>Petugas dalam tabel s.d.</span><input type="number" id="tBt" min="2" max="40" value="${esc(p.batasTabelPetugas)}"></label></div>
        <div class="dua"><label class="f"><span>Kode QR verifikasi di surat</span><select id="tQr"><option value="ya" ${p.pakaiQr !== 'tidak' ? 'selected' : ''}>Ya, tampilkan</option><option value="tidak" ${p.pakaiQr === 'tidak' ? 'selected' : ''}>Tidak</option></select></label><label class="f"><span>Ukuran QR (inci)</span><input type="number" id="tQl" min="0.5" max="1.4" step="0.05" value="${esc(p.qrLebar || '0.8')}"></label></div>
        <p class="petunjuk">Surat tugas: sampai ${esc(p.batasBlokPetugas)} orang ditulis per blok (seperti contoh), sampai ${esc(p.batasTabelPetugas)} orang dalam tabel, lebih dari itu dipindah ke halaman lampiran.</p>
      </div>
      <button class="btn utama-b" id="bSimpanTampil">Simpan</button>`;
    $('#bSimpanTampil').onclick = () => {
      const bb = +$('#tBb').value, bt = +$('#tBt').value;
      if (bt < bb) return toast('Batas tabel harus ≥ batas blok.', 'galat');
      simpanPengaturan({ fontIsi: $('#tFi').value, ukuranIsi: $('#tSi').value, fontTugas: $('#tFt').value, ukuranTugas: $('#tSt').value, fontTtd: $('#tFd').value, ukuranTtd: $('#tSd').value, zonaWaktu: $('#tZona').value, batasBlokPetugas: String(bb), batasTabelPetugas: String(bt), pakaiQr: $('#tQr').value, qrLebar: $('#tQl').value });
    };
  }

  function tabIntegrasi() {
    const p = S.p;
    $('#isiTab').innerHTML = `
      <div class="kartu"><h3>Aplikasi Kegiatan & Sertifikat</h3>
        <label class="f"><span>Nama menu</span><input type="text" id="iNama" value="${esc(p.namaAplikasiSertifikat)}"></label>
        <label class="f"><span>Alamat (URL) aplikasi</span><input type="url" id="iUrl" value="${esc(p.urlSertifikat)}" placeholder="https://persagisulsel.github.io/daftar-hadir/"></label>
        <button class="btn utama-b" id="bSimpanInt">Simpan</button>
      </div>
      <div class="kartu"><h3>Cara kerja SSO</h3>
        <p style="line-height:1.7;margin:0">Setelah login di portal, token disimpan di peramban dengan kunci <code>persagi_sso</code>. Aplikasi lain yang berada di domain yang sama (mis. <code>persagisulsel.github.io/…</code>) cukup membaca token itu, lalu memverifikasinya ke server portal dengan aksi <code>whoami</code>. Bila belum login, arahkan ke:<br><code>${esc(location.origin + location.pathname)}#/login?next=&lt;alamat aplikasi&gt;</code><br>Rincian kode untuk aplikasi Sertifikat ada di PANDUAN.md.</p>
      </div>`;
    $('#bSimpanInt').onclick = async () => { if (await simpanPengaturan({ namaAplikasiSertifikat: $('#iNama').value, urlSertifikat: $('#iUrl').value.trim() })) viewPengaturan('integrasi'); };
  }

  async function tabAkun() {
    $('#isiTab').innerHTML = '<div class="kartu"><div class="kosong">Memuat…</div></div>';
    let data;
    try { data = (await api('admin.list', {}, { diam: true })).data; } catch (e) { $('#isiTab').innerHTML = `<div class="kartu kosong">${esc(e.message)}</div>`; return; }
    const segarkan = d => { data = d; S.akun = d.filter(a => aktif(a.aktif)).map(a => ({ username: a.username, nama: a.nama, peran: a.peran, pengurusId: a.pengurusId, hp: a.hp })); const me = d.find(a => a.username === S.user.username); if (me) S.user.pengurusId = me.pengurusId; g(); };
    const form = a => {
      const x = a || { username: '', nama: '', peran: 'sekretaris', pengurusId: '', hp: '' };
      return `${a ? '' : '<label class="f"><span>Username</span><input type="text" id="aU" placeholder="sekretaris"></label>'}
        <label class="f"><span>Nama tampilan</span><input type="text" id="aN" value="${esc(x.nama)}"></label>
        <div class="dua"><label class="f"><span>Peran</span><select id="aR" ${a && a.username === S.user.username ? 'disabled' : ''}><option value="sekretaris" ${x.peran !== 'ketua' ? 'selected' : ''}>Sekretaris (mengetik & mengirim)</option><option value="ketua" ${x.peran === 'ketua' ? 'selected' : ''}>Ketua (memeriksa & menandatangani)</option></select></label>
        <label class="f"><span>No. WA <i>(untuk pemberitahuan)</i></span><input type="text" id="aH" value="${esc(x.hp)}" placeholder="0812xxxxxxx" inputmode="tel"></label></div>
        <label class="f"><span>Tautkan ke pengurus <i>(wajib untuk Ketua: TTD & nama penandatangan)</i></span><select id="aPid"><option value="">— tidak ditautkan —</option>${S.pengurus.filter(p => aktif(p.aktif)).map(p => `<option value="${esc(p.id)}" ${p.id === x.pengurusId ? 'selected' : ''}>${esc(p.nama)} — ${esc(p.jabatan)}</option>`).join('')}</select></label>
        ${a ? '' : '<label class="f"><span>Password awal <i>(min. 6 karakter)</i></span><input type="text" id="aP"></label>'}`;
    };
    const ambil = (l, a) => ({ username: a ? a.username : $('#aU', l).value, nama: $('#aN', l).value, peran: $('#aR', l).value, hp: $('#aH', l).value, pengurusId: $('#aPid', l).value, ...(a ? {} : { password: $('#aP', l).value }) });
    const g = () => {
      $('#isiTab').innerHTML = `<div class="kartu"><h3>Akun portal <button class="btn kecil utama-b" id="bTambahA">+ Tambah akun</button></h3>
        <div class="tabel-wrap"><table class="tb"><thead><tr><th>Username</th><th>Nama</th><th>Peran</th><th>Pengurus tertaut</th><th>No. WA</th><th>Status</th><th></th></tr></thead><tbody>
        ${data.map(a => `<tr class="${aktif(a.aktif) ? '' : 'nonaktif'}"><td class="mono">${esc(a.username)}${a.username === S.user.username ? ' <span class="lencana biru">anda</span>' : ''}</td><td>${esc(a.nama)}</td>
        <td>${a.peran === 'ketua' ? '<span class="lencana terbit">Ketua</span>' : '<span class="lencana">Sekretaris</span>'}</td>
        <td>${esc((pengurusById(a.pengurusId) || {}).nama || '—')}</td><td class="mono">${esc(a.hp || '—')}</td>
        <td>${aktif(a.aktif) ? '<span class="lencana terbit">aktif</span>' : '<span class="lencana">nonaktif</span>'}${String(a.harusGanti).toUpperCase() === 'TRUE' ? ' <span class="lencana draf">wajib ganti password</span>' : ''}</td>
        <td><div class="deret" style="flex-wrap:nowrap"><button class="btn kecil" data-edit="${esc(a.username)}">Edit</button>${a.username === S.user.username ? '' : `<button class="btn kecil" data-reset="${esc(a.username)}">Reset password</button><button class="btn kecil" data-akt="${esc(a.username)}">${aktif(a.aktif) ? 'Nonaktifkan' : 'Aktifkan'}</button><button class="btn kecil merah" data-del="${esc(a.username)}">Hapus</button>`}</div></td></tr>`).join('')}
        </tbody></table></div>
        <p class="petunjuk" style="margin:10px 0 0"><b>Sekretaris</b>: mengetik surat, mengajukan ke Ketua, mengunduh PDF final, menandai terkirim. <b>Ketua</b>: memeriksa, mengedit, mengembalikan, dan menandatangani; hanya Ketua yang bisa melihat & memakai gambar TTD dan stempel. Nomor WA dipakai untuk tombol pemberitahuan.</p></div>`;
      $('#bTambahA').onclick = async () => {
        const r = await modal({ judul: 'Tambah akun', isi: form(null), tombol: [{ label: 'Batal' }, { label: 'Simpan', kelas: 'utama-b', aksi: async l => { try { return (await api('admin.simpan', { item: ambil(l, null) })).data; } catch (e) { toast(e.message, 'galat'); return false; } } }] });
        if (r) { segarkan(r); toast('Akun ditambahkan.', 'sukses'); }
      };
      $$('[data-edit]').forEach(b => b.onclick = async () => {
        const a = data.find(x => x.username === b.dataset.edit);
        const r = await modal({ judul: 'Edit akun ' + a.username, isi: form(a), tombol: [{ label: 'Batal' }, { label: 'Simpan', kelas: 'utama-b', aksi: async l => { const it = ambil(l, a); it.aktif = aktif(a.aktif); if (a.username === S.user.username) delete it.peran; try { return (await api('admin.simpan', { item: it })).data; } catch (e) { toast(e.message, 'galat'); return false; } } }] });
        if (r) { segarkan(r); toast('Akun diperbarui.', 'sukses'); }
      });
      $$('[data-reset]').forEach(b => b.onclick = async () => {
        const r = await modal({ judul: 'Reset password ' + b.dataset.reset, isi: `<label class="f"><span>Password baru (sementara)</span><input type="text" id="aP"></label>`, tombol: [{ label: 'Batal' }, { label: 'Simpan', kelas: 'utama-b', aksi: async l => { const pw = $('#aP', l).value; if (pw.length < 6) { toast('Minimal 6 karakter.', 'galat'); return false; } try { return (await api('admin.simpan', { item: { username: b.dataset.reset, password: pw, aktif: true } })).data; } catch (e) { toast(e.message, 'galat'); return false; } } }] });
        if (r) { segarkan(r); toast('Password direset.', 'sukses'); }
      });
      $$('[data-akt]').forEach(b => b.onclick = async () => { const a = data.find(x => x.username === b.dataset.akt); try { segarkan((await api('admin.simpan', { item: { username: a.username, aktif: !aktif(a.aktif) } })).data); } catch (e) { toast(e.message, 'galat'); } });
      $$('[data-del]').forEach(b => b.onclick = async () => { if (!(await konfirmasi('Hapus akun', `Hapus akun <b>${esc(b.dataset.del)}</b>?`, 'Hapus', 'merah'))) return; try { segarkan((await api('admin.hapus', { username: b.dataset.del })).data); } catch (e) { toast(e.message, 'galat'); } });
    };
    g();
  }

  async function tabLog() {
    $('#isiTab').innerHTML = '<div class="kartu"><div class="kosong">Memuat…</div></div>';
    try {
      const d = (await api('log.list', {}, { diam: true })).data;
      $('#isiTab').innerHTML = `<div class="kartu"><h3>300 aktivitas terakhir</h3><div class="tabel-wrap" style="max-height:600px"><table class="tb"><thead><tr><th>Waktu</th><th>Admin</th><th>Aksi</th><th>Rincian</th></tr></thead><tbody>${d.map(x => `<tr><td style="white-space:nowrap">${esc(String(x.waktu).replace('T', ' '))}</td><td>${esc(x.username)}</td><td>${esc(x.aksi)}</td><td>${esc(x.detail)}</td></tr>`).join('')}</tbody></table></div></div>`;
    } catch (e) { $('#isiTab').innerHTML = `<div class="kartu kosong">${esc(e.message)}</div>`; }
  }

  /* ---------------- Mulai ---------------- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  if (!CFG.API_URL || /GANTI_DENGAN/.test(CFG.API_URL)) {
    document.getElementById('app').innerHTML = '<div class="kosong" style="padding:60px 20px;line-height:1.7"><b>API_URL belum diatur.</b><br>Isi URL /exec Apps Script di file <code>config.js</code> (lihat PANDUAN.md).</div>';
  } else route();
})();
