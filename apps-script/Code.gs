/**
 * PORTAL DPD PERSAGI SULAWESI SELATAN — Backend (Google Apps Script)
 * Modul: SSO admin, Data Pengurus, Generate Surat (penomoran otomatis), Pengaturan, Arsip PDF.
 *
 * CARA PASANG (ringkas):
 * 1. Buat Google Sheet baru → Ekstensi → Apps Script → tempel seluruh file ini.
 * 2. Jalankan fungsi setup() sekali (izinkan akses). Sheet, data 59 pengurus, akun admin awal,
 *    dan nomor surat terakhir (035/2026) dibuat otomatis.
 * 3. Deploy → Deployment baru → Aplikasi web → Jalankan sebagai: Saya, Akses: Siapa saja.
 * 4. Salin URL /exec ke config.js (API_URL).
 * Akun awal: admin / persagi2026  (wajib ganti saat login pertama).
 */

const VERSI = '1.0.0';
const MASA_SESI_HARI = 7;
const NAMA_FOLDER = 'Portal PERSAGI Sulsel';

const KOLOM = {
  Admin:      ['username', 'nama', 'salt', 'hash', 'aktif', 'harusGanti', 'dibuat'],
  Sesi:       ['token', 'username', 'nama', 'kadaluarsa'],
  Pengurus:   ['id', 'nama', 'jabatan', 'kelompok', 'kta', 'hp', 'email', 'aktif', 'catatan', 'diubah', 'diubahOleh'],
  Surat:      ['id', 'jenis', 'status', 'nomor', 'noUrut', 'tahun', 'tanggal', 'perihal', 'ringkas', 'data', 'pdfId', 'pdfUrl', 'dibuat', 'dibuatOleh', 'diubah', 'diubahOleh'],
  Penomoran:  ['tahun', 'terakhir'],
  Pengaturan: ['kunci', 'nilai'],
  Log:        ['waktu', 'username', 'aksi', 'detail']
};

const PENGATURAN_AWAL = {
  kota: 'Makassar',
  formatNomor: '{NO}/DPD-PERSAGI-SULSEL/{BLN}/{THN}',
  digitNomor: '3',
  ttdBaris: 'Dewan Pimpinan Daerah\nPersatuan Ahli Gizi Indonesia Provinsi\nSulawesi Selatan\nKetua',
  labelKta: 'KTA : ',
  penandatanganId: '',
  fontIsi: 'Cambria',
  ukuranIsi: '12',
  fontTugas: 'Arial',
  ukuranTugas: '12',
  fontTtd: 'Arial',
  ukuranTtd: '12',
  zonaWaktu: 'WITA',
  batasBlokPetugas: '3',
  batasTabelPetugas: '10',
  ttdLebar: '2.1', ttdX: '-0.3', ttdY: '0.35',
  stempelLebar: '1.07', stempelX: '-0.55', stempelY: '0.2', stempelOpasitas: '0.85',
  urlSertifikat: '',
  namaAplikasiSertifikat: 'Kegiatan & Sertifikat'
};

const DATA_PENGURUS_AWAL = [
  ["Dr. Nadimin, SKM, M.Kes, Dietisien", "Ketua Dewan Pembina", "Dewan Pembina", "73712103196600149"],
  ["Agus Windiarso, SKM, M.Kes", "Anggota Dewan Pembina", "Dewan Pembina", "-"],
  ["Dr. Ir. H. Agustian Ipa, M.Kes", "Anggota Dewan Pembina", "Dewan Pembina", "-"],
  ["St. Fatimah, DCN, M.Kes", "Anggota Dewan Pembina", "Dewan Pembina", "-"],
  ["Yustini, DCN, M.Kes, RD", "Anggota Dewan Pembina", "Dewan Pembina", "73712605196300242"],
  ["Manjilala, S.Gz, M.Gizi", "Ketua", "Pengurus Harian", "73710910197700184"],
  ["Astati Made Amin, S.SiT, M.Kes", "Wakil Ketua 1", "Pengurus Harian", "73712109196800838"],
  ["Andi Imam Arundhana, S.Gz, M.P.H, PhD", "Wakil Ketua 2", "Pengurus Harian", "73710107198800612"],
  ["Putri Indah Nirmalasari, S.Tr.Gz., M.K.M., Dietisien", "Sekretaris", "Pengurus Harian", "73711007199300945"],
  ["Dian Andayani Muchtar, S.Gz, M.Kes., Dietisien", "Bendahara", "Pengurus Harian", "73722212198200380"],
  ["Asriaty, S.Gz, Dietisien", "Ketua Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "73712411197001090"],
  ["Irsa Tamru, SKM, M.Kes", "Anggota Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "73710305196401833"],
  ["Mira Andini, S.Gz, M.Gz", "Anggota Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "73710511198802135"],
  ["Musyawarah Thahir, S.SiT, M.Kes, Dietisien", "Anggota Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "73712604197300195"],
  ["Sitti Rahmatiah, SKM, M.Kes", "Anggota Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "73713103197601826"],
  ["Thresia Dewi Kartini B., SKM, M.Si", "Anggota Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "73712004197200234"],
  ["Askar Yusuf, S.Gz", "Anggota Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "73711412199500687"],
  ["Meita Amirah Kuncoro, S.Gz.,M.Kes.,Dietisien", "Anggota Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "Bidang Pengembangan Organisasi, Penjaminan Mutu dan Manajemen Risiko", "73712405199100638"],
  ["Dr. Sirajuddin, SP, M.Kes, RD", "Ketua Bidang Ilmiah, Kebijakan, Riset dan Inovasi", "Bidang Ilmiah, Kebijakan, Riset dan Inovasi", "73710302196900223"],
  ["Nani Apriani Natsir Djide, S.Gz., M.K.M", "Anggota Bidang Ilmiah, Kebijakan, riset dan Inovasi", "Bidang Ilmiah, Kebijakan, Riset dan Inovasi", "73711104199401533"],
  ["Dr. H. Mustamin, SP, M.Kes", "Anggota Bidang Ilmiah, Kebijakan, riset dan Inovasi", "Bidang Ilmiah, Kebijakan, Riset dan Inovasi", "73091906196700320"],
  ["Letda Kes Agung Dirgantara N, S.Gz, M.Gz, Dietisien", "Anggota Bidang Ilmiah, Kebijakan, riset dan Inovasi", "Bidang Ilmiah, Kebijakan, Riset dan Inovasi", "53710904199300006"],
  ["St. Khaerawati, SKM, RD", "Anggota Bidang Ilmiah, Kebijakan, riset dan Inovasi", "Bidang Ilmiah, Kebijakan, Riset dan Inovasi", "73711406197000264"],
  ["Syamsiah Nur, S.Gz, RD", "Anggota Bidang Ilmiah, Kebijakan, riset dan Inovasi", "Bidang Ilmiah, Kebijakan, Riset dan Inovasi", "73710310197101260"],
  ["Nabilah Mustafaina Kamil, S.Gz.,M.Gz.,Dietisien", "Anggota Bidang Ilmiah, Kebijakan, riset dan Inovasi", "Bidang Ilmiah, Kebijakan, Riset dan Inovasi", "73712607199801843"],
  ["Rizka Purnamasari, S.Gz", "Anggota Bidang Ilmiah, Kebijakan, riset dan Inovasi", "Bidang Ilmiah, Kebijakan, Riset dan Inovasi", "73711507199200912"],
  ["Risma Ernawati, S.ST, M.M", "Ketua Bidang Kemitraan", "Bidang Kemitraan", "73143012196600535"],
  ["Nursalim, S.Gz, M.Si", "Anggota Bidang Kemitraan", "Bidang Kemitraan", "73712011197600207"],
  ["Hermawati Balfas, AMG", "Anggota Bidang Kemitraan", "Bidang Kemitraan", "73710506197400853"],
  ["Andi Zubaedah, SKM, M.Kes, RD", "Anggota Bidang Kemitraan", "Bidang Kemitraan", "73710911197001113"],
  ["Suriani Rauf, S.SiT, M.Si", "Anggota Bidang Kemitraan", "Bidang Kemitraan", "73711507196600232"],
  ["Kurnia yusuf, S.Gz., M.Kes", "Anggota Bidang Kemitraan", "Bidang Kemitraan", "73080505198601269"],
  ["Tri Darmawati Tato, S.Gz, RD", "Anggota Bidang Kemitraan", "Bidang Kemitraan", "73710804197101092"],
  ["Chaerunnimah, SKM, M.Kes", "Anggota Bidang Kemitraan", "Bidang Kemitraan", "73710305197500285"],
  ["Sadariah L, S.SiT", "Anggota Bidang Kemitraan", "Bidang Kemitraan", "73713112196701685"],
  ["Andi Dian Purnamasari, S.Gz", "Ketua Bidang Kesejahteraan dan Pelayanan Anggota", "Bidang Kesejahteraan dan Pelayanan Anggota", "73712009202201726"],
  ["Nilawardany, SKM, M.Kes, RD", "Anggota Bidang Kesejahteraan dan Pelayanan Anggota", "Bidang Kesejahteraan dan Pelayanan Anggota", "73100803197300466"],
  ["Muhammad Dehiyah Akmal Nasution, S.Gz", "Anggota Bidang Kesejahteraan dan Pelayanan Anggota", "Bidang Kesejahteraan dan Pelayanan Anggota", "73712603197100190"],
  ["Aswita Amir, A, M.Si, RD", "Anggota Bidang Kesejahteraan dan Pelayanan Anggota", "Bidang Kesejahteraan dan Pelayanan Anggota", "73711601199700284"],
  ["Ahmad Ismail, SKM, M.Kes", "Anggota Bidang Kesejahteraan dan Pelayanan Anggota", "Bidang Kesejahteraan dan Pelayanan Anggota", "73712503196801365"],
  ["Astuti Asis, SKM, M.Kes", "Anggota Bidang Kesejahteraan dan Pelayanan Anggota", "Bidang Kesejahteraan dan Pelayanan Anggota", "73711110202201739"],
  ["Nusrah Ningsih, S.SiT, M.Kes, Dietisien", "Anggota Bidang Kesejahteraan dan Pelayanan Anggota", "Bidang Kesejahteraan dan Pelayanan Anggota", "73712402197000209"],
  ["Surahmansah Said, S.Gz, M.P.H", "Anggota Bidang Kesejahteraan dan Pelayanan Anggota", "Bidang Kesejahteraan dan Pelayanan Anggota", "73710408198800825"],
  ["Fitriah, SST, M.Kes", "Ketua Bidang Teknologi Informasi dan Publikasi", "Bidang Teknologi Informasi dan Publikasi", "73710305199100399"],
  ["Muhajirin Tahir, S.Tr. Gz", "Anggota Teknologi Informasi dan Publikasi", "Bidang Teknologi Informasi dan Publikasi", "73711811199400189"],
  ["Ihsan, S.Tr.Gz", "Anggota Teknologi Informasi dan Publikasi", "Bidang Teknologi Informasi dan Publikasi", "73710710199200991"],
  ["Sahwin Permadi Yahya, S.Tr.Gz, M.Gz", "Anggota Teknologi Informasi dan Publikasi", "Bidang Teknologi Informasi dan Publikasi", "73110503199200676"],
  ["Andi Fitriani Zainuddin,SKM", "Anggota Teknologi Informasi dan Publikasi", "Bidang Teknologi Informasi dan Publikasi", "73101904198500354"],
  ["Andi Rizky Awalia Amisyah, A.Md.Gz", "Anggota Teknologi Informasi dan Publikasi", "Bidang Teknologi Informasi dan Publikasi", "73712210199400613"],
  ["Hardyanty Subair, S.Gz", "Anggota Teknologi Informasi dan Publikasi", "Bidang Teknologi Informasi dan Publikasi", "7371080920002122"],
  ["Fauziah Hamid, S.Gz", "Anggota Teknologi Informasi dan Publikasi", "Bidang Teknologi Informasi dan Publikasi", "73711702199200926"],
  ["Hijrah Asikin, S.ST, M.Biomed", "Ketua Bidang Gizi Bencana", "Bidang Gizi Bencana", "73710811198501750"],
  ["Muhammad Iskandar Hafid, SKM, M.P.H", "Anggota Bidang Gizi Bencana", "Bidang Gizi Bencana", "73711303197401662"],
  ["Kartini, S.ST", "Anggota Bidang Gizi Bencana", "Bidang Gizi Bencana", "73712104198901663"],
  ["Nur Ayu Ruhmayanti, S.Gz., M.Gizi, Dietisien", "Anggota Bidang Gizi Bencana", "Bidang Gizi Bencana", "73712110198800954"],
  ["Syamsuddin, SKM, M.Kes", "Anggota Bidang Gizi Bencana", "Bidang Gizi Bencana", "73710707196701398"],
  ["Edy Suhenwinro Bakri, Amd.Gz.", "Anggota Bidang Gizi Bencana", "Bidang Gizi Bencana", "73711110199100150"],
  ["Indra Jaya, S.ST", "Anggota Bidang Gizi Bencana", "Bidang Gizi Bencana", "73711512197300175"],
  ["Hasan, SST", "Anggota Bidang Gizi Bencana", "Bidang Gizi Bencana", "73710505197800258"]

];

/* ======================= SETUP ======================= */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(KOLOM).forEach(function (nama) {
    let sh = ss.getSheetByName(nama);
    if (!sh) sh = ss.insertSheet(nama);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, KOLOM[nama].length).setValues([KOLOM[nama]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  // Kolom KTA, nomor, tanggal disimpan sebagai teks
  ss.getSheetByName('Pengurus').getRange('E:E').setNumberFormat('@');
  ss.getSheetByName('Surat').getRange('D:H').setNumberFormat('@');

  // Pengurus awal
  const shP = ss.getSheetByName('Pengurus');
  let idKetua = '';
  if (shP.getLastRow() < 2) {
    const kini = new Date();
    const rows = DATA_PENGURUS_AWAL.map(function (r, i) {
      const id = 'P' + ('00' + (i + 1)).slice(-3);
      if (r[1] === 'Ketua') idKetua = id;
      return [id, r[0], r[1], r[2], String(r[3]), '', '', true, '', kini, 'setup'];
    });
    shP.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
  // Pengaturan awal
  const shS = ss.getSheetByName('Pengaturan');
  const ada = bacaPengaturan_();
  const tambah = [];
  Object.keys(PENGATURAN_AWAL).forEach(function (k) {
    if (!(k in ada)) tambah.push([k, k === 'penandatanganId' ? idKetua : PENGATURAN_AWAL[k]]);
  });
  if (tambah.length) {
    shS.getRange('B:B').setNumberFormat('@');
    shS.getRange(shS.getLastRow() + 1, 1, tambah.length, 2).setValues(tambah);
  }
  // Penomoran: surat terakhir 2026 = 035
  const shN = ss.getSheetByName('Penomoran');
  if (shN.getLastRow() < 2) shN.appendRow([2026, 35]);
  // Admin awal
  const shA = ss.getSheetByName('Admin');
  if (shA.getLastRow() < 2) {
    const salt = Utilities.getUuid();
    shA.appendRow(['admin', 'Administrator', salt, hash_('persagi2026', salt), true, true, new Date()]);
  }
  folder_();
  return 'Setup selesai';
}

/* ======================= ROUTER ======================= */
function doGet() {
  return json_({ ok: true, app: 'Portal PERSAGI Sulsel', versi: VERSI });
}

function doPost(e) {
  let req = {};
  try {
    req = JSON.parse(e.postData.contents || '{}');
    const aksi = req.action;
    if (aksi === 'login') return json_(login_(req));
    if (aksi === 'whoami') return json_(whoami_(req.token));

    const sesi = cekSesi_(req.token);
    if (!sesi) return json_({ ok: false, error: 'SESI_HABIS', pesan: 'Sesi berakhir, silakan login kembali.' });

    const H = {
      'logout': logout_, 'gantiPassword': gantiPassword_, 'init': init_,
      'pengurus.simpan': pengurusSimpan_, 'pengurus.hapus': pengurusHapus_,
      'surat.list': suratList_, 'surat.get': suratGet_, 'surat.simpan': suratSimpan_,
      'surat.batal': suratBatal_, 'surat.simpanPdf': suratSimpanPdf_,
      'pengaturan.simpan': pengaturanSimpan_, 'penomoran.set': penomoranSet_,
      'gambar.simpan': gambarSimpan_, 'gambar.hapus': gambarHapus_,
      'admin.list': adminList_, 'admin.simpan': adminSimpan_, 'admin.hapus': adminHapus_,
      'log.list': logList_
    };
    if (!H[aksi]) return json_({ ok: false, pesan: 'Aksi tidak dikenal: ' + aksi });
    return json_(H[aksi](req, sesi));
  } catch (err) {
    return json_({ ok: false, pesan: String(err && err.message || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ======================= UTIL SHEET ======================= */
function sh_(nama) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nama); }

function baca_(nama) {
  const sh = sh_(nama);
  const n = sh.getLastRow();
  if (n < 2) return [];
  const kol = KOLOM[nama];
  return sh.getRange(2, 1, n - 1, kol.length).getValues().map(function (r, i) {
    const o = { _baris: i + 2 };
    kol.forEach(function (k, j) { o[k] = r[j]; });
    return o;
  });
}

function tulisBaris_(nama, baris, obj) {
  const kol = KOLOM[nama];
  sh_(nama).getRange(baris, 1, 1, kol.length).setValues([kol.map(function (k) { return obj[k] === undefined ? '' : obj[k]; })]);
}

function tambahBaris_(nama, obj) {
  const sh = sh_(nama);
  const kol = KOLOM[nama];
  const baris = sh.getLastRow() + 1;
  sh.getRange(baris, 1, 1, kol.length).setValues([kol.map(function (k) { return obj[k] === undefined ? '' : obj[k]; })]);
  return baris;
}

function bersih_(o) {
  const r = {};
  Object.keys(o).forEach(function (k) {
    if (k === '_baris') return;
    const v = o[k];
    r[k] = v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") : v;
  });
  return r;
}

function log_(username, aksi, detail) {
  try { sh_('Log').appendRow([new Date(), username, aksi, String(detail || '').slice(0, 500)]); } catch (e) { }
}

function hash_(pw, salt) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pw, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); }).join('');
}

/* ======================= AUTH / SSO ======================= */
function login_(req) {
  const u = String(req.username || '').trim().toLowerCase();
  const a = baca_('Admin').filter(function (x) { return String(x.username).toLowerCase() === u; })[0];
  if (!a || a.aktif === false || String(a.aktif).toUpperCase() === 'FALSE' || hash_(String(req.password || ''), a.salt) !== a.hash) {
    Utilities.sleep(600);
    return { ok: false, pesan: 'Username atau password salah.' };
  }
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const exp = Date.now() + MASA_SESI_HARI * 864e5;
  tambahBaris_('Sesi', { token: token, username: a.username, nama: a.nama, kadaluarsa: exp });
  CacheService.getScriptCache().put('s_' + token, JSON.stringify({ username: a.username, nama: a.nama, exp: exp }), 21600);
  bersihkanSesi_();
  log_(a.username, 'login', '');
  return { ok: true, token: token, username: a.username, nama: a.nama, exp: exp, harusGanti: a.harusGanti === true || String(a.harusGanti).toUpperCase() === 'TRUE' };
}

function cekSesi_(token) {
  if (!token) return null;
  const c = CacheService.getScriptCache().get('s_' + token);
  if (c) { const o = JSON.parse(c); if (o.exp > Date.now()) return o; }
  const s = baca_('Sesi').filter(function (x) { return x.token === token; })[0];
  if (!s || Number(s.kadaluarsa) < Date.now()) return null;
  const o = { username: s.username, nama: s.nama, exp: Number(s.kadaluarsa) };
  CacheService.getScriptCache().put('s_' + token, JSON.stringify(o), 21600);
  return o;
}

/** Dipakai aplikasi lain (mis. Sertifikat) untuk memverifikasi token SSO. */
function whoami_(token) {
  const s = cekSesi_(token);
  return s ? { ok: true, username: s.username, nama: s.nama, exp: s.exp } : { ok: false, error: 'SESI_HABIS' };
}

function logout_(req) {
  CacheService.getScriptCache().remove('s_' + req.token);
  const s = baca_('Sesi').filter(function (x) { return x.token === req.token; })[0];
  if (s) sh_('Sesi').deleteRow(s._baris);
  return { ok: true };
}

function bersihkanSesi_() {
  const sh = sh_('Sesi');
  const rows = baca_('Sesi');
  for (let i = rows.length - 1; i >= 0; i--) if (Number(rows[i].kadaluarsa) < Date.now()) sh.deleteRow(rows[i]._baris);
}

function gantiPassword_(req, sesi) {
  const a = baca_('Admin').filter(function (x) { return x.username === sesi.username; })[0];
  if (!a) return { ok: false, pesan: 'Akun tidak ditemukan.' };
  if (hash_(String(req.lama || ''), a.salt) !== a.hash) return { ok: false, pesan: 'Password lama salah.' };
  if (String(req.baru || '').length < 6) return { ok: false, pesan: 'Password baru minimal 6 karakter.' };
  a.salt = Utilities.getUuid(); a.hash = hash_(req.baru, a.salt); a.harusGanti = false;
  tulisBaris_('Admin', a._baris, a);
  log_(sesi.username, 'gantiPassword', '');
  return { ok: true };
}

function adminList_() {
  return { ok: true, data: baca_('Admin').map(function (a) { return { username: a.username, nama: a.nama, aktif: a.aktif, harusGanti: a.harusGanti }; }) };
}

function adminSimpan_(req, sesi) {
  const d = req.item || {};
  const u = String(d.username || '').trim().toLowerCase();
  if (!/^[a-z0-9_.]{3,30}$/.test(u)) return { ok: false, pesan: 'Username 3–30 karakter (huruf kecil, angka, titik, garis bawah).' };
  const rows = baca_('Admin');
  const a = rows.filter(function (x) { return x.username === u; })[0];
  if (a) {
    a.nama = d.nama || a.nama;
    a.aktif = d.aktif !== false;
    if (d.password) { a.salt = Utilities.getUuid(); a.hash = hash_(d.password, a.salt); a.harusGanti = true; }
    if (u === sesi.username && !a.aktif) return { ok: false, pesan: 'Tidak bisa menonaktifkan akun sendiri.' };
    tulisBaris_('Admin', a._baris, a);
  } else {
    if (String(d.password || '').length < 6) return { ok: false, pesan: 'Password minimal 6 karakter.' };
    const salt = Utilities.getUuid();
    tambahBaris_('Admin', { username: u, nama: d.nama || u, salt: salt, hash: hash_(d.password, salt), aktif: true, harusGanti: true, dibuat: new Date() });
  }
  log_(sesi.username, 'admin.simpan', u);
  return adminList_();
}

function adminHapus_(req, sesi) {
  if (req.username === sesi.username) return { ok: false, pesan: 'Tidak bisa menghapus akun sendiri.' };
  const a = baca_('Admin').filter(function (x) { return x.username === req.username; })[0];
  if (a) sh_('Admin').deleteRow(a._baris);
  log_(sesi.username, 'admin.hapus', req.username);
  return adminList_();
}

/* ======================= INIT ======================= */
function bacaPengaturan_() {
  const o = {};
  baca_('Pengaturan').forEach(function (r) { o[r.kunci] = String(r.nilai); });
  return o;
}

function bacaPenomoran_() {
  const o = {};
  baca_('Penomoran').forEach(function (r) { o[String(r.tahun)] = Number(r.terakhir) || 0; });
  return o;
}

function init_(req, sesi) {
  const p = bacaPengaturan_();
  Object.keys(PENGATURAN_AWAL).forEach(function (k) { if (!(k in p)) p[k] = PENGATURAN_AWAL[k]; });
  return {
    ok: true,
    user: sesi,
    pengaturan: p,
    penomoran: bacaPenomoran_(),
    pengurus: baca_('Pengurus').map(bersih_),
    gambar: bacaSemuaGambar_(p)
  };
}

/* ======================= PENGURUS ======================= */
function pengurusSimpan_(req, sesi) {
  const d = req.item || {};
  if ((!d.id || d.nama !== undefined) && !String(d.nama || '').trim()) return { ok: false, pesan: 'Nama wajib diisi.' };
  const rows = baca_('Pengurus');
  let r = d.id ? rows.filter(function (x) { return x.id === d.id; })[0] : null;
  const kini = new Date();
  if (r) {
    ['nama', 'jabatan', 'kelompok', 'kta', 'hp', 'email', 'catatan'].forEach(function (k) { if (d[k] !== undefined) r[k] = String(d[k]); });
    if (d.aktif !== undefined) r.aktif = !!d.aktif;
    r.diubah = kini; r.diubahOleh = sesi.username;
    tulisBaris_('Pengurus', r._baris, r);
    log_(sesi.username, 'pengurus.ubah', r.id + ' ' + r.nama + ' KTA:' + r.kta);
  } else {
    let maks = 0;
    rows.forEach(function (x) { const n = parseInt(String(x.id).replace(/\D/g, ''), 10); if (n > maks) maks = n; });
    r = { id: 'P' + ('00' + (maks + 1)).slice(-3), nama: d.nama, jabatan: d.jabatan || '', kelompok: d.kelompok || '', kta: String(d.kta || ''), hp: d.hp || '', email: d.email || '', aktif: d.aktif !== false, catatan: d.catatan || '', diubah: kini, diubahOleh: sesi.username };
    tambahBaris_('Pengurus', r);
    log_(sesi.username, 'pengurus.tambah', r.id + ' ' + r.nama);
  }
  return { ok: true, pengurus: baca_('Pengurus').map(bersih_) };
}

function pengurusHapus_(req, sesi) {
  const r = baca_('Pengurus').filter(function (x) { return x.id === req.id; })[0];
  if (r) { sh_('Pengurus').deleteRow(r._baris); log_(sesi.username, 'pengurus.hapus', r.id + ' ' + r.nama); }
  return { ok: true, pengurus: baca_('Pengurus').map(bersih_) };
}

/* ======================= SURAT ======================= */
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

function formatNomor_(noUrut, tanggal, p) {
  const t = String(tanggal).split('-');
  const dig = parseInt(p.digitNomor || '3', 10) || 3;
  const no = ('0000000' + noUrut).slice(-dig);
  return String(p.formatNomor || PENGATURAN_AWAL.formatNomor)
    .replace('{NO}', no).replace('{BLN}', ROMAWI[parseInt(t[1], 10) - 1]).replace('{THN}', t[0]);
}

function suratList_(req) {
  const th = req.tahun ? String(req.tahun) : '';
  const data = baca_('Surat').filter(function (s) { return !th || String(s.tahun) === th || (!s.tahun && String(s.tanggal).indexOf(th) === 0); })
    .map(function (s) { const o = bersih_(s); delete o.data; return o; });
  return { ok: true, data: data, penomoran: bacaPenomoran_() };
}

function suratGet_(req) {
  const s = baca_('Surat').filter(function (x) { return x.id === req.id; })[0];
  if (!s) return { ok: false, pesan: 'Surat tidak ditemukan.' };
  const o = bersih_(s);
  try { o.data = JSON.parse(s.data || '{}'); } catch (e) { o.data = {}; }
  return { ok: true, item: o };
}

function suratSimpan_(req, sesi) {
  const d = req.item || {};
  const dataStr = JSON.stringify(d.data || {});
  if (dataStr.length > 49000) return { ok: false, pesan: 'Isi surat terlalu panjang untuk disimpan (maks ±49.000 karakter). Pindahkan sebagian ke lampiran atau kurangi format.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.tanggal || ''))) return { ok: false, pesan: 'Tanggal surat belum diisi.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const rows = baca_('Surat');
    let s = d.id ? rows.filter(function (x) { return x.id === d.id; })[0] : null;
    const kini = new Date();
    if (!s) {
      s = { id: 'S' + Utilities.formatDate(kini, 'GMT', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10), status: 'draf', nomor: '', noUrut: '', tahun: '', dibuat: kini, dibuatOleh: sesi.username, pdfId: '', pdfUrl: '' };
    }
    if (s.status === 'batal') return { ok: false, pesan: 'Surat yang dibatalkan tidak bisa diubah.' };
    s.jenis = d.jenis; s.tanggal = d.tanggal; s.perihal = d.perihal || ''; s.ringkas = String(d.ringkas || '').slice(0, 300);
    s.data = dataStr; s.diubah = kini; s.diubahOleh = sesi.username;

    if (d.terbitkan && s.status !== 'terbit') {
      const p = bacaPengaturan_();
      const tahun = String(d.tanggal).slice(0, 4);
      const shN = sh_('Penomoran');
      const nr = baca_('Penomoran').filter(function (x) { return String(x.tahun) === tahun; })[0];
      const berikut = (nr ? Number(nr.terakhir) || 0 : 0) + 1;
      if (nr) shN.getRange(nr._baris, 2).setValue(berikut); else shN.appendRow([Number(tahun), berikut]);
      s.noUrut = berikut; s.tahun = tahun; s.nomor = formatNomor_(berikut, d.tanggal, p); s.status = 'terbit';
      log_(sesi.username, 'surat.terbit', s.nomor + ' — ' + s.perihal);
    } else if (s.status === 'terbit' && String(s.tanggal).slice(0, 4) !== String(s.tahun)) {
      return { ok: false, pesan: 'Tahun tanggal surat tidak boleh berbeda dari tahun nomor surat (' + s.tahun + ').' };
    } else {
      log_(sesi.username, d.id ? 'surat.ubah' : 'surat.draf', (s.nomor || s.id) + ' — ' + s.perihal);
    }
    if (s._baris) tulisBaris_('Surat', s._baris, s); else tambahBaris_('Surat', s);
    const o = bersih_(s); o.data = d.data || {};
    return { ok: true, item: o, penomoran: bacaPenomoran_() };
  } finally {
    lock.releaseLock();
  }
}

function suratBatal_(req, sesi) {
  const s = baca_('Surat').filter(function (x) { return x.id === req.id; })[0];
  if (!s) return { ok: false, pesan: 'Surat tidak ditemukan.' };
  if (s.status === 'draf') { sh_('Surat').deleteRow(s._baris); log_(sesi.username, 'surat.hapusDraf', s.id); return { ok: true, dihapus: true }; }
  s.status = 'batal'; s.diubah = new Date(); s.diubahOleh = sesi.username;
  tulisBaris_('Surat', s._baris, s);
  log_(sesi.username, 'surat.batal', s.nomor + ' ' + (req.alasan || ''));
  return { ok: true };
}

function suratSimpanPdf_(req, sesi) {
  const s = baca_('Surat').filter(function (x) { return x.id === req.id; })[0];
  if (!s) return { ok: false, pesan: 'Surat tidak ditemukan.' };
  const b64 = String(req.base64 || '').replace(/^data:[^,]+,/, '');
  const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'application/pdf', String(req.namaFile || (s.id + '.pdf')));
  const folder = subFolder_(['Arsip Surat', String(s.tahun || String(s.tanggal).slice(0, 4))]);
  if (s.pdfId) { try { DriveApp.getFileById(s.pdfId).setTrashed(true); } catch (e) { } }
  const f = folder.createFile(blob);
  s.pdfId = f.getId(); s.pdfUrl = f.getUrl();
  tulisBaris_('Surat', s._baris, s);
  return { ok: true, pdfUrl: s.pdfUrl };
}

function penomoranSet_(req, sesi) {
  const th = parseInt(req.tahun, 10), n = parseInt(req.terakhir, 10);
  if (!(th > 2000) || !(n >= 0)) return { ok: false, pesan: 'Tahun/nomor tidak valid.' };
  const r = baca_('Penomoran').filter(function (x) { return Number(x.tahun) === th; })[0];
  if (r) sh_('Penomoran').getRange(r._baris, 2).setValue(n); else sh_('Penomoran').appendRow([th, n]);
  log_(sesi.username, 'penomoran.set', th + ' → ' + n);
  return { ok: true, penomoran: bacaPenomoran_() };
}

/* ======================= PENGATURAN & GAMBAR ======================= */
function pengaturanSimpan_(req, sesi) {
  const d = req.data || {};
  const sh = sh_('Pengaturan');
  const rows = baca_('Pengaturan');
  Object.keys(d).forEach(function (k) {
    if (k.indexOf('img_') === 0) return;
    const r = rows.filter(function (x) { return x.kunci === k; })[0];
    if (r) sh.getRange(r._baris, 2).setNumberFormat('@').setValue(String(d[k]));
    else sh.appendRow([k, String(d[k])]);
  });
  log_(sesi.username, 'pengaturan.simpan', Object.keys(d).join(','));
  const p = bacaPengaturan_();
  Object.keys(PENGATURAN_AWAL).forEach(function (k) { if (!(k in p)) p[k] = PENGATURAN_AWAL[k]; });
  return { ok: true, pengaturan: p };
}

function folder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  const f = DriveApp.createFolder(NAMA_FOLDER);
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}

function subFolder_(jalur) {
  let f = folder_();
  jalur.forEach(function (n) {
    const it = f.getFoldersByName(n);
    f = it.hasNext() ? it.next() : f.createFolder(n);
  });
  return f;
}

function namaGambarSah_(n) { return /^(kop|footer|stempel|ttd_[A-Za-z0-9]+)$/.test(String(n)); }

function gambarSimpan_(req, sesi) {
  const nama = String(req.nama || '');
  if (!namaGambarSah_(nama)) return { ok: false, pesan: 'Nama gambar tidak sah.' };
  const m = String(req.dataUrl || '').match(/^data:(image\/(png|jpeg|webp));base64,(.+)$/);
  if (!m) return { ok: false, pesan: 'Format gambar harus PNG/JPG/WebP.' };
  const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
  const blob = Utilities.newBlob(Utilities.base64Decode(m[3]), m[1], nama + '.' + ext);
  const fol = subFolder_(['Gambar']);
  const p = bacaPengaturan_();
  if (p['img_' + nama]) { try { DriveApp.getFileById(p['img_' + nama]).setTrashed(true); } catch (e) { } }
  const f = fol.createFile(blob);
  simpanKunci_('img_' + nama, f.getId());
  log_(sesi.username, 'gambar.simpan', nama);
  return { ok: true, gambar: bacaSemuaGambar_(bacaPengaturan_()) };
}

function gambarHapus_(req, sesi) {
  const nama = String(req.nama || '');
  const p = bacaPengaturan_();
  if (p['img_' + nama]) { try { DriveApp.getFileById(p['img_' + nama]).setTrashed(true); } catch (e) { } }
  simpanKunci_('img_' + nama, '');
  log_(sesi.username, 'gambar.hapus', nama);
  return { ok: true, gambar: bacaSemuaGambar_(bacaPengaturan_()) };
}

function simpanKunci_(k, v) {
  const sh = sh_('Pengaturan');
  const r = baca_('Pengaturan').filter(function (x) { return x.kunci === k; })[0];
  if (r) sh.getRange(r._baris, 2).setValue(v); else sh.appendRow([k, v]);
}

function bacaSemuaGambar_(p) {
  const out = {};
  Object.keys(p).forEach(function (k) {
    if (k.indexOf('img_') !== 0 || !p[k]) return;
    try {
      const b = DriveApp.getFileById(p[k]).getBlob();
      out[k.slice(4)] = 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
    } catch (e) { }
  });
  return out;
}

function logList_() {
  const rows = baca_('Log');
  return { ok: true, data: rows.slice(-300).reverse().map(bersih_) };
}
