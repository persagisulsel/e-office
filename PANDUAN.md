# Portal PERSAGI Sulsel — Panduan Pasang

Portal ini punya satu login (SSO) untuk admin. Isinya: **Generate Surat**, **Data Pengurus**, **Pengaturan**, dan tautan ke aplikasi **Kegiatan & Sertifikat**.

## 1. Backend (Google Apps Script)
1. Buat Google Sheet baru, misalnya "DB Portal PERSAGI Sulsel".
2. Buka **Ekstensi → Apps Script**, hapus isi bawaannya, lalu tempel seluruh isi `apps-script/Code.gs`.
3. Pilih fungsi `setup` dan klik **Jalankan**. Izinkan akses ke Spreadsheet dan Drive. Fungsi ini otomatis membuat:
   - 7 sheet: Admin, Sesi, Pengurus, Surat, Penomoran, Pengaturan, Log
   - 59 data pengurus, dengan KTA disalin apa adanya
   - nomor surat terakhir tahun 2026 = **035**, jadi surat berikutnya bernomor 036
   - akun awal **admin / persagi2026**, yang wajib diganti saat login pertama
   - folder Drive "Portal PERSAGI Sulsel", untuk arsip PDF, TTD, dan stempel
4. Klik **Terapkan → Deployment baru → Aplikasi web**, dengan pengaturan *Jalankan sebagai: Saya* dan *Akses: Siapa saja*. Salin URL `/exec`.

## 2. Frontend (GitHub Pages)
1. Isi `API_URL` di `config.js` dengan URL `/exec` tadi.
2. Unggah seluruh isi folder ini ke repositori GitHub (misalnya `persagisulsel/portal`), lalu aktifkan **Settings → Pages**.
3. Buka `https://persagisulsel.github.io/portal/`.

> File TTD dan stempel **jangan** diunggah ke GitHub. Unggah lewat menu **Pengaturan → TTD & Stempel**, supaya file tersimpan di Drive dan hanya terbaca setelah login.

## 3. Setelah login pertama
- **Pengaturan → TTD & Stempel**: unggah TTD Ketua dan stempel, lalu atur posisinya dengan slider.
- **Data Pengurus → centang "KTA perlu dicek"**: lengkapi KTA yang masih kosong atau kurang digit.
- **Pengaturan → Akun admin**: tambahkan admin lain, misalnya sekretaris.
- **Pengaturan → Integrasi**: isi URL aplikasi Kegiatan & Sertifikat.

## 4. Alur surat (versi 1.1)
1. **Sekretaris** mengetik surat, lalu menekan **Ajukan ke Ketua**. Setelah itu muncul tombol WA untuk mengabari Ketua.
2. **Ketua** membuka link dari WA (bisa lewat HP) dan memeriksa pratinjau surat. Ada tiga pilihan:
   - **Setujui & Tanda Tangani**: nomor diberikan otomatis, TTD + stempel + kode QR dibubuhkan, dan PDF final tersimpan di Drive.
   - **Edit dulu**: Ketua memperbaiki sendiri, lalu menandatangani.
   - **Kembalikan**: Ketua menulis catatan, lalu surat kembali ke sekretaris.
3. **Sekretaris** mengunduh **PDF final**, mengirimkannya, lalu menekan **Tandai terkirim**.
4. Penerima surat bisa memindai **kode QR** untuk memastikan keaslian surat. Halaman verifikasi bisa dibuka tanpa login.

Pengaturan akun ada di **Pengaturan → Akun**:
- Akun Ketua harus *ditautkan ke pengurus* (nama Ketua).
- Isi **No. WA** setiap akun.
- Gambar TTD dan stempel hanya terlihat dan terpakai di akun Ketua.

## 5. Menghubungkan aplikasi lain ke SSO
Aplikasi lain harus berada di domain yang sama (`persagisulsel.github.io/...`). Tempel kode ini di bagian paling awal aplikasi:

```js
const PORTAL = 'https://persagisulsel.github.io/portal/';
const PORTAL_API = 'https://script.google.com/macros/s/XXXX/exec'; // API portal
const sso = JSON.parse(localStorage.getItem('persagi_sso') || 'null');
if (!sso || sso.exp < Date.now()) {
  location.href = PORTAL + '#/login?next=' + encodeURIComponent(location.href);
}
// (disarankan) verifikasi token ke server portal:
fetch(PORTAL_API, { method: 'POST', body: JSON.stringify({ action: 'whoami', token: sso.token }) })
  .then(r => r.json()).then(j => { if (!j.ok) location.href = PORTAL + '#/login?next=' + encodeURIComponent(location.href); });
```

Kalau backend aplikasi lain (Apps Script) juga perlu memeriksa token, panggil `UrlFetchApp.fetch(PORTAL_API, {method:'post', payload: JSON.stringify({action:'whoami', token})})`.

## Memperbarui Code.gs (tanpa mengganti URL)
Tempel `Code.gs` yang baru, lalu klik **Terapkan → Kelola deployment → Edit (pensil) → Versi: Versi baru → Terapkan**. Data lama otomatis disesuaikan dengan versi baru:
- akun `admin` menjadi Ketua;
- surat berstatus "terbit" menjadi "ditandatangani".

## Catatan teknis
- Ukuran kertas F4 (8,5 × 13 inci). Tata letak meniru surat 031 dan 035: isi surat Cambria 12, surat tugas dan blok tanda tangan Arial 12.
- **Unduh PDF** membuat file PDF yang langsung terunduh dan sekaligus tersimpan ke arsip Drive. **Cetak** memakai dialog cetak peramban (pilih "Simpan sebagai PDF") dan menghasilkan teks yang lebih tajam.
- Nomor surat dikunci di server (LockService), jadi tidak mungkin ada nomor dobel. Surat yang dibatalkan tetap mempertahankan nomornya.
