# Website Pemesanan — Yudha Entertainment

Website untuk sewa tenda, organ tunggal, gerabah, lampu & listrik.
Pelanggan memilih paket/barang, memilih tanggal & lokasi, lalu pesanan terkirim lewat WhatsApp.
Admin mencatat detail acara di halaman `/admin`; tanggal yang sudah dipesan otomatis tertutup di website.
Server & database berjalan di NAS (Node.js + PostgreSQL).

## Struktur folder

```
yudha-entertainment/
├── index.html        # Halaman utama
├── css/style.css     # Semua tampilan (warna tema di bagian :root)
├── js/data.js        # ← EDIT DI SINI: nomor WA, harga, produk, tanggal penuh
├── js/app.js         # Logika keranjang, kalender, kirim WA
├── admin.html        # Halaman admin (login)
├── css/admin.css, js/admin.js
├── assets/img/       # Taruh foto asli di sini
├── server/           # Backend: Express + PostgreSQL + JWT
│   ├── .env.example  # ← salin jadi .env lalu isi
│   ├── schema.sql    # Tabel (dibuat otomatis saat server start)
│   └── server.js
├── Dockerfile, docker-compose.yml   # Untuk menjalankan di NAS
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
| `namaKontak` | Nama yang ditampilkan di samping nomor (sekarang: Bejo) |
| `ongkirEstimasi` | Perkiraan ongkir yang ditambahkan ke total |
| `jadwalURL` | Sumber status tanggal dari server (default `api/jadwal.csv`) |
| `katalogURL` | Sumber katalog dari server (default `api/katalog.json`) |
| `tanggalPenuh` / `tanggalHampirPenuh` | Cadangan kalau server tidak bisa dihubungi |
| `minimalHariPesan` | Pesanan paling cepat H+berapa |
| `KATEGORI`, `PAKET`, `PRODUK` | **Hanya isi awal** database & cadangan. Setelah server jalan, ubah lewat `/admin` → **Katalog** |

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
- Status tanggal dibaca dari server NAS (lihat bagian di bawah). Daftar `tanggalPenuh` / `tanggalHampirPenuh` di `data.js` hanya cadangan kalau server tidak bisa dihubungi.

## Server NAS & halaman admin

### Cara kerja

- Admin login di `http://<alamat-server>/admin`, lalu mencatat pesanan: tanggal, sesi, jenis acara, jam pasang/bongkar,
  data pelanggan, barang/paket & harga, ongkir, DP, status, dan catatan kru.
- Status tanggal di website dihitung otomatis:
  - ada pesanan **Dikonfirmasi/Selesai** (sebanyak `MAKS_ACARA_PER_HARI`) → **Penuh**, tidak bisa dipilih pelanggan;
  - ada pesanan **Menunggu** → **Hampir penuh**;
  - pesanan **Batal** tidak dihitung.
- Tab **Katalog**: admin menambah/mengubah/menghapus kategori, paket (nama, isi paket, harga, label sorotan) dan produk satuan
  (harga, satuan, kelipatan). Item bisa disembunyikan sementara tanpa dihapus. Website langsung memakai data baru.
  Saat server pertama kali jalan, katalog diisi dari `js/data.js`.
- Admin juga bisa mengatur status satu tanggal secara manual (mis. tutup tanggal karena libur), dan bisa dikembalikan ke otomatis.
- Website umum hanya membaca `api/jadwal.csv` (tanggal + status) dan `api/katalog.json`. Data pelanggan & pesanan **tidak pernah** dikirim ke pengunjung.

### Hosting di NAS dengan Docker

Website, halaman admin, dan API jalan dalam **satu container** (`yudha-app`, port 3100).
Database memakai PostgreSQL yang sudah ada di NAS (yang juga dipakai Project Control Dashboard); database `yudha_entertainment` dibuat otomatis.

1. **Salin folder ke NAS.** Lewat SSH: `git clone https://github.com/syamsul-huda/yudha-entertainment.git`
   (atau upload foldernya ke shared folder NAS, mis. `/volume1/docker/yudha-entertainment`).
2. **Buat file `server/.env`** dari `server/.env.example`, lalu isi:
   - `DB_HOST`: **IP LAN NAS** (mis. `192.168.1.10`), bukan `localhost`, karena aplikasi berjalan di dalam container;
   - `DB_PASSWORD`: password PostgreSQL;
   - `JWT_SECRET`: string acak panjang → `openssl rand -hex 32`;
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD`: akun admin pertama.
3. **Jalankan.** Lewat SSH di folder itu: `docker compose up -d --build`.
   Atau lewat aplikasi Docker di UGREEN NAS: buat **Project** baru, pilih folder ini (berisi `docker-compose.yml`), lalu deploy.
4. Buka `http://<IP-NAS>:3100` (website) dan `http://<IP-NAS>:3100/admin` (admin).
5. Setelah login pertama, ganti password lewat tombol **Ganti password**, lalu hapus `ADMIN_PASSWORD` dari `.env`.

Container otomatis hidup lagi setelah NAS restart (`restart: unless-stopped`) dan diberi health check (`/api/health`).

**Update setelah ada perubahan kode:**

```
cd yudha-entertainment
git pull
docker compose up -d --build
```

Data pesanan & katalog aman karena tersimpan di PostgreSQL, bukan di container.

**Lihat log kalau ada masalah:** `docker logs -f yudha-app`

Tambah admin lain / reset password lupa:

```
docker exec yudha-app npm run admin:buat -- budi PasswordBaru123 "Budi Santoso"
```

### Menjalankan di laptop (untuk coba-coba)

```
cd server
cp .env.example .env     # isi DB_HOST dengan IP NAS, dll.
npm install
npm start                # buka http://localhost:3100 dan /admin
```

### Agar bisa dibuka dari internet

NAS ada di jaringan rumah/kantor, jadi perlu jembatan ke internet. Paling mudah **Cloudflare Tunnel** (gratis, otomatis HTTPS, tidak perlu buka port router):

1. Punya domain yang DNS-nya di Cloudflare (domain dari DomaiNesia bisa dipindah nameserver-nya ke Cloudflare).
2. Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create tunnel** → salin token.
3. Tambah `TUNNEL_TOKEN=...` di `server/.env`, aktifkan bagian `tunnel` di `docker-compose.yml`, lalu `docker compose up -d`.
4. Di pengaturan tunnel, tambahkan *public hostname* (mis. `yudha.domainanda.id`) → service `http://app:3100`.
5. Isi `TRUST_PROXY=true` di `.env`.

Kalau website tetap ingin di GitHub Pages, isi `jadwalURL` di `js/data.js` dengan alamat lengkap, mis.
`https://yudha.domainanda.id/api/jadwal.csv`. Halaman admin tetap dibuka dari alamat server NAS.

### Backup

Semua data ada di database `yudha_entertainment`. Backup berkala, mis.:

```
pg_dump -h <IP-NAS> -U postgres yudha_entertainment > backup-yudha-$(date +%F).sql
```
