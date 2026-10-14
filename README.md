# Website Pemesanan — Yudha Entertainment

Website statis (HTML + CSS + JavaScript biasa) untuk sewa tenda, organ tunggal, gerabah, lampu & listrik.
Pelanggan memilih paket/barang, memilih tanggal & lokasi, lalu pesanan terkirim lewat WhatsApp. Tanpa login, tanpa database.

## Struktur folder

```
yudha-entertainment/
├── index.html        # Halaman utama
├── css/style.css     # Semua tampilan (warna tema di bagian :root)
├── js/data.js        # ← EDIT DI SINI: nomor WA, harga, produk, tanggal penuh
├── js/app.js         # Logika keranjang, kalender, kirim WA
├── assets/img/       # Taruh foto asli di sini
└── .vscode/          # Rekomendasi ekstensi Live Server
```

## Menjalankan di VS Code

1. Buka folder ini: **File → Open Folder… → YUDHA ENTERTAINMENT**
2. Pasang ekstensi **Live Server** (VS Code akan menawarkannya otomatis).
3. Klik kanan `index.html` → **Open with Live Server**. Browser terbuka di `http://127.0.0.1:5500`.
4. Untuk mencoba tampilan HP: tekan `F12` di browser → ikon HP (Toggle device toolbar).

Untuk tes dari HP sungguhan di jaringan Wi-Fi yang sama, buka `http://IP-laptop-Anda:5500` di HP.

## Yang perlu diubah sebelum dikirim ke klien

Semua ada di `js/data.js`:

| Pengaturan | Keterangan |
|---|---|
| `nomorWA` | Nomor tujuan pesanan, format `628xxxxxxxxxx` (tanpa `+` dan tanpa `0` di depan) |
| `nomorTelepon` | Untuk tombol telepon |
| `ongkirEstimasi` | Perkiraan ongkir yang ditambahkan ke total |
| `tanggalPenuh` / `tanggalHampirPenuh` | Daftar tanggal `"YYYY-MM-DD"`, warna kalender ikut berubah |
| `minimalHariPesan` | Pesanan paling cepat H+berapa |
| `PAKET`, `PRODUK` | Nama, harga, satuan, fitur, `kelipatan` (mis. kursi per 50) |

**Foto:** simpan file di `assets/img/`, lalu isi kolom `foto`, contoh `foto: "assets/img/paket-nikahan.jpg"`.
Foto hero dan galeri ada di `index.html` (cari komentar `Ganti div ini`).
Ukuran ideal: lebar 1200 px, kompres dulu (mis. lewat squoosh.app) agar di bawah 300 KB per foto.

## Membagikan ke klien (agar bisa dicoba dari HP)

Pilih salah satu:

- **Netlify Drop (paling cepat, gratis):** buka app.netlify.com/drop lalu seret folder ini. Dapat link `https://nama-acak.netlify.app` yang bisa langsung dikirim lewat WA.
- **GitHub Pages:** push folder ke repo GitHub → Settings → Pages → branch `main`.
- **Domain sendiri:** unggah isi folder ke hosting (mis. subdomain `demo.domainanda.id`).

Agar pratinjau link di WhatsApp ada gambarnya, isi `og:image` di `index.html` dengan URL foto lengkap (https).

## Catatan

- Isi keranjang tersimpan di browser pelanggan (localStorage), jadi tidak hilang saat halaman dimuat ulang.
- Status tanggal dibaca dari Google Sheets (lihat bagian di bawah). Daftar `tanggalPenuh` / `tanggalHampirPenuh` di `data.js` hanya cadangan kalau spreadsheet gagal dibaca.

## Jadwal dari Google Sheets

Pemilik usaha cukup mengisi spreadsheet; kalender di website ikut berubah tanpa mengedit kode.

**1. Buat spreadsheet** dengan 3 kolom (baris pertama judul):

| tanggal | status | keterangan |
|---|---|---|
| 2026-11-07 | penuh | Nikahan Bpk. Ahmad |
| 2026-11-08 | hampir | Tenda 6x12 sudah keluar |

- `tanggal`: `2026-11-07` atau `7/11/2026` (hari/bulan/tahun).
- `status`: `penuh` → tanggal dicoret & tidak bisa dipilih. `hampir` → kuning, masih bisa dipilih. Selain itu dianggap tersedia.
- `keterangan`: catatan admin, **tidak** tampil di website.
- Cara cepat: **File → Impor** file `jadwal-contoh.csv` dari folder ini.
- Agar format tanggal tidak berubah sendiri, blok kolom A → **Format → Angka → Teks biasa**.

**2. Publikasikan sebagai CSV:** **File → Bagikan → Publikasikan ke web** → pilih sheet-nya → format **Nilai yang dipisahkan koma (.csv)** → **Publikasikan**. Salin link-nya
(bentuknya `https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv`).

**3. Tempel link** ke `jadwalSheetCSV` di `js/data.js`.

Catatan:
- Website mengambil jadwal saat dibuka, setiap 2 menit, dan saat pelanggan kembali ke tab. Google sendiri menyimpan cache CSV ±5 menit, jadi perubahan baru terlihat setelah beberapa menit.
- Isi sheet yang dipublikasikan bisa dibaca siapa saja yang tahu link-nya. Jangan tulis nomor HP / alamat lengkap pelanggan di kolom keterangan; simpan data pribadi di sheet lain yang tidak dipublikasikan.
- Kalau tanggal yang sedang dipilih pelanggan berubah jadi penuh, pilihannya dihapus dan muncul pemberitahuan.
- Ini tetap **manual**: admin yang menandai tanggal penuh setelah pesanan dikonfirmasi. Pesanan dari WhatsApp tidak masuk ke sheet otomatis.
