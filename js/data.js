/* =========================================================
   DATA & PENGATURAN USAHA
   Nomor WA, alamat, ongkir: edit di file ini.
   Kategori, paket, produk & harga: diatur admin di /admin → Katalog
   (daftar di bawah hanya isi awal database & cadangan).
   ========================================================= */

window.CONFIG = {
  namaUsaha: "Yudha Entertainment",
  tagline: "Sewa Tenda · Organ Tunggal · Gerabah · Lampu & Listrik",

  // Nomor WhatsApp tujuan pesanan. Format internasional TANPA "+" dan TANPA "0" di depan.
  // Contoh: 0812-3456-7890  ->  "6281234567890"
  nomorWA: "6282170847132",
  nomorTelepon: "082170847132",
  namaKontak: "Bejo",

  // Estimasi ongkir (ditampilkan sebagai perkiraan, final dikonfirmasi admin)
  ongkirEstimasi: 150000,
  ongkirKeterangan: "± 15 km",

  areaLayanan: "[Kota / kecamatan yang dilayani]",
  alamatGudang: "[Alamat gudang]",
  jamBuka: "[Hari & jam operasional]",

  // Sumber status tanggal (CSV: tanggal,status). Diisi otomatis dari pesanan di halaman admin.
  // - Website dibuka dari server NAS          -> biarkan "api/jadwal.csv"
  // - Website di GitHub Pages / hosting lain  -> isi alamat lengkap, mis. "https://yudha.domainanda.id/api/jadwal.csv"
  // Kalau tidak bisa dibaca, dipakai dua daftar cadangan di bawah.
  jadwalURL: "api/jadwal.csv",

  // Sumber katalog (kategori, paket, produk, harga) yang diatur admin di halaman /admin → Katalog.
  // Sama seperti jadwalURL: alamat lengkap kalau website tidak dibuka dari server NAS.
  // Kalau tidak bisa dibaca, dipakai KATEGORI / PAKET / PRODUK di bawah (juga isi awal database).
  katalogURL: "api/katalog.json",

  // Cadangan kalau spreadsheet tidak bisa dibaca. Format: "YYYY-MM-DD"
  tanggalPenuh: ["2026-11-07", "2026-11-14", "2026-11-22", "2026-12-05", "2026-12-12"],
  tanggalHampirPenuh: ["2026-11-08", "2026-11-15", "2026-11-21", "2026-11-28", "2026-11-29", "2026-12-06"],

  // Berapa hari ke depan minimal pemesanan (0 = boleh hari ini)
  minimalHariPesan: 2
};

window.KATEGORI = [
  { id: "all", label: "Semua" },
  { id: "tenda", label: "Tenda & Dekorasi" },
  { id: "organ", label: "Organ Tunggal" },
  { id: "gerabah", label: "Gerabah & Dapur" },
  { id: "lampu", label: "Lampu & Listrik" }
];

// Paket. "foto" boleh dikosongkan ("") -> tampil placeholder.
// Untuk foto asli: taruh file di folder assets/img lalu isi misalnya "assets/img/paket-nikahan.jpg"
window.PAKET = [
  {
    id: "p1", kategori: "tenda", nama: "Paket Nikahan Lengkap", harga: 12000000, satuan: "paket",
    badge: "Paling diminati", foto: "", keteranganFoto: "tenda & pelaminan",
    fitur: ["Tenda 6x12 m + dekorasi standar", "Kursi & meja 100 set", "Organ tunggal 4 jam", "Lampu & listrik lengkap"]
  },
  {
    id: "p2", kategori: "organ", nama: "Paket Organ Tunggal", harga: 1500000, satuan: "acara",
    foto: "", keteranganFoto: "panggung organ",
    fitur: ["1 player + penyanyi", "Sound system lengkap", "Durasi 4–6 jam"]
  },
  {
    id: "p3", kategori: "gerabah", nama: "Paket Peralatan Makan 100 Porsi", harga: 750000, satuan: "paket",
    foto: "", keteranganFoto: "piring & gelas gerabah",
    fitur: ["Piring, gelas, mangkuk", "Peralatan masak besar", "Antar & ambil kembali"]
  },
  {
    id: "p4", kategori: "lampu", nama: "Paket Lampu & Genset", harga: 1000000, satuan: "paket",
    foto: "", keteranganFoto: "lampu malam & genset",
    fitur: ["Lampu penerangan area", "Kabel & instalasi", "Genset sesuai kebutuhan"]
  }
];

// Produk satuan. "kelipatan" = jumlah bertambah per klik (mis. kursi per 50).
window.PRODUK = [
  { id: "i1", kategori: "tenda", nama: "Tenda 6x6 m", harga: 2500000, satuan: "hari", foto: "", keteranganFoto: "tenda 6x6" },
  { id: "i2", kategori: "tenda", nama: "Tenda 6x12 m", harga: 3000000, satuan: "hari", foto: "", keteranganFoto: "tenda 6x12" },
  { id: "i5", kategori: "tenda", nama: "Kursi Plastik", harga: 2000, satuan: "buah", kelipatan: 50, foto: "", keteranganFoto: "kursi" },
  { id: "i6", kategori: "tenda", nama: "Meja Bulat + Taplak", harga: 25000, satuan: "buah", kelipatan: 5, foto: "", keteranganFoto: "meja bulat" },
  { id: "i3", kategori: "organ", nama: "Sound System Full Set", harga: 750000, satuan: "hari", foto: "", keteranganFoto: "speaker" },
  { id: "i4", kategori: "organ", nama: "Penyanyi Tambahan", harga: 300000, satuan: "acara", foto: "", keteranganFoto: "mikrofon" },
  { id: "i7", kategori: "gerabah", nama: "Set Piring & Gelas", harga: 5000, satuan: "set", kelipatan: 50, foto: "", keteranganFoto: "piring gerabah" },
  { id: "i8", kategori: "lampu", nama: "Genset 5 kVA", harga: 600000, satuan: "hari", foto: "", keteranganFoto: "genset" }
];

window.WAKTU = [
  { id: "pagi", label: "Pagi", jam: "06.00–12.00" },
  { id: "siang", label: "Siang", jam: "12.00–18.00" },
  { id: "malam", label: "Malam", jam: "18.00–24.00" }
];
