-- Dijalankan otomatis setiap server start (aman diulang).

CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nama          TEXT NOT NULL DEFAULT '',
  aktif         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pesanan (
  id             SERIAL PRIMARY KEY,
  tanggal        DATE NOT NULL,
  sesi           TEXT NOT NULL DEFAULT 'malam',
  jenis_acara    TEXT NOT NULL DEFAULT '',
  jam_pasang     TEXT NOT NULL DEFAULT '',
  jam_bongkar    TEXT NOT NULL DEFAULT '',
  nama_pelanggan TEXT NOT NULL,
  no_hp          TEXT NOT NULL DEFAULT '',
  alamat         TEXT NOT NULL DEFAULT '',
  barang         JSONB NOT NULL DEFAULT '[]',   -- [{ "nama": "...", "qty": 1, "harga": 0 }]
  ongkir         INTEGER NOT NULL DEFAULT 0,
  total          INTEGER NOT NULL DEFAULT 0,    -- dihitung server: barang + ongkir
  dp             INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'menunggu'
                 CHECK (status IN ('menunggu', 'dikonfirmasi', 'selesai', 'batal')),
  catatan        TEXT NOT NULL DEFAULT '',
  dibuat_oleh    TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pesanan_tanggal_idx ON pesanan (tanggal);

-- Status tanggal yang diatur manual admin; mengalahkan status otomatis dari pesanan.
CREATE TABLE IF NOT EXISTS status_tanggal (
  tanggal    DATE PRIMARY KEY,
  status     TEXT NOT NULL CHECK (status IN ('penuh', 'hampir', 'tersedia')),
  catatan    TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Katalog yang bisa diubah admin. Diisi pertama kali dari js/data.js.
CREATE TABLE IF NOT EXISTS kategori (
  id     TEXT PRIMARY KEY,               -- dipakai di URL/CSS, mis. "tenda"
  label  TEXT NOT NULL,
  urutan INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS katalog (
  id              TEXT PRIMARY KEY,      -- mis. "p1" (paket) / "i5" (produk satuan)
  tipe            TEXT NOT NULL CHECK (tipe IN ('paket', 'produk')),
  kategori        TEXT NOT NULL DEFAULT '',
  nama            TEXT NOT NULL,
  harga           INTEGER NOT NULL DEFAULT 0,
  satuan          TEXT NOT NULL DEFAULT 'paket',
  kelipatan       INTEGER NOT NULL DEFAULT 1,
  badge           TEXT NOT NULL DEFAULT '',
  fitur           JSONB NOT NULL DEFAULT '[]',   -- isi paket, satu baris per poin
  foto            TEXT NOT NULL DEFAULT '',
  keterangan_foto TEXT NOT NULL DEFAULT '',
  aktif           BOOLEAN NOT NULL DEFAULT TRUE,
  urutan          INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
