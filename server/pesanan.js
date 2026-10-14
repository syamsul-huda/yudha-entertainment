const express = require("express");
const db = require("./db");
const { wajibLogin } = require("./auth");

const SESI = ["pagi", "siang", "malam", "seharian"];
const STATUS = ["menunggu", "dikonfirmasi", "selesai", "batal"];
const STATUS_TANGGAL = ["penuh", "hampir", "tersedia"];
// Berapa acara terkonfirmasi dalam sehari sampai tanggal dianggap penuh.
const MAKS_ACARA = Math.max(1, Number(process.env.MAKS_ACARA_PER_HARI) || 1);

const isTanggal = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const teks = (v, max = 300) => String(v == null ? "" : v).trim().slice(0, max);
const angka = (v) => Math.max(0, Math.round(Number(v) || 0));

/* Status per tanggal:
   1. status manual admin (status_tanggal) selalu menang;
   2. pesanan dikonfirmasi/selesai >= MAKS_ACARA  -> penuh;
   3. ada pesanan aktif lain (termasuk menunggu)  -> hampir.
   Pesanan batal tidak dihitung. */
async function statusTanggal(dari, sampai) {
  const { rows } = await db.query(
    `WITH hitung AS (
       SELECT tanggal,
              COUNT(*) FILTER (WHERE status IN ('dikonfirmasi', 'selesai'))::int AS fix,
              COUNT(*)::int AS aktif
       FROM pesanan
       WHERE status <> 'batal' AND tanggal BETWEEN $1 AND $2
       GROUP BY tanggal
     ), manual AS (
       SELECT tanggal, status, catatan FROM status_tanggal WHERE tanggal BETWEEN $1 AND $2
     )
     SELECT tanggal,
            COALESCE(m.status, CASE WHEN h.fix >= $3 THEN 'penuh' ELSE 'hampir' END) AS status,
            m.status IS NOT NULL AS manual,
            COALESCE(m.catatan, '') AS catatan,
            COALESCE(h.fix, 0) AS fix,
            COALESCE(h.aktif, 0) AS aktif
     FROM hitung h FULL JOIN manual m USING (tanggal)
     ORDER BY tanggal`,
    [dari, sampai, MAKS_ACARA]
  );
  return rows;
}

function validasiPesanan(b) {
  const p = {
    tanggal: teks(b.tanggal, 10),
    sesi: teks(b.sesi, 20),
    jenis_acara: teks(b.jenis_acara, 100),
    jam_pasang: teks(b.jam_pasang, 100),
    jam_bongkar: teks(b.jam_bongkar, 100),
    nama_pelanggan: teks(b.nama_pelanggan, 120),
    no_hp: teks(b.no_hp, 30),
    alamat: teks(b.alamat, 500),
    ongkir: angka(b.ongkir),
    dp: angka(b.dp),
    status: teks(b.status, 20) || "menunggu",
    catatan: teks(b.catatan, 2000),
    barang: []
  };
  if (!isTanggal(p.tanggal)) return { error: "Tanggal acara tidak valid." };
  if (!p.nama_pelanggan) return { error: "Nama pelanggan wajib diisi." };
  if (!SESI.includes(p.sesi)) return { error: "Sesi tidak valid." };
  if (!STATUS.includes(p.status)) return { error: "Status tidak valid." };
  if (!Array.isArray(b.barang) || b.barang.length > 100) return { error: "Daftar barang tidak valid." };
  for (const x of b.barang) {
    const item = { nama: teks(x && x.nama, 120), qty: angka(x && x.qty), harga: angka(x && x.harga) };
    if (item.nama && item.qty > 0) p.barang.push(item);
  }
  p.total = p.barang.reduce((s, x) => s + x.qty * x.harga, 0) + p.ongkir;
  return { pesanan: p };
}

const KOLOM = ["tanggal", "sesi", "jenis_acara", "jam_pasang", "jam_bongkar", "nama_pelanggan", "no_hp",
  "alamat", "barang", "ongkir", "total", "dp", "status", "catatan"];
const nilai = (p) => KOLOM.map((k) => (k === "barang" ? JSON.stringify(p.barang) : p[k]));

/* ---------- Publik: hanya tanggal & status, tanpa data pelanggan ---------- */
const publik = express.Router();

publik.get("/jadwal.csv", async (req, res) => {
  try {
    const d = new Date(); // zona waktu dari TZ (Asia/Jakarta di docker-compose)
    const hariIni = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const rows = await statusTanggal(hariIni, "9999-12-31");
    const csv = ["tanggal,status"]
      .concat(rows.filter((r) => r.status !== "tersedia").map((r) => r.tanggal + "," + r.status))
      .join("\n");
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*" // boleh dibaca dari GitHub Pages
    }).send(csv + "\n");
  } catch (err) {
    console.error(err);
    res.status(500).type("text/plain").send("error");
  }
});

/* ---------- Admin ---------- */
const admin = express.Router();
admin.use(wajibLogin);

// Data kalender admin: status per tanggal + ringkasan pesanan dalam rentang.
admin.get("/kalender", async (req, res) => {
  const { dari, sampai } = req.query;
  if (!isTanggal(dari) || !isTanggal(sampai)) return res.status(400).json({ error: "Rentang tanggal tidak valid." });
  try {
    const [status, pesanan] = await Promise.all([
      statusTanggal(dari, sampai),
      db.query("SELECT * FROM pesanan WHERE tanggal BETWEEN $1 AND $2 ORDER BY tanggal, id", [dari, sampai])
    ]);
    res.json({ status, pesanan: pesanan.rows, maksAcara: MAKS_ACARA });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memuat kalender." });
  }
});

admin.get("/pesanan", async (req, res) => {
  const where = [], params = [];
  if (isTanggal(req.query.dari || "")) { params.push(req.query.dari); where.push(`tanggal >= $${params.length}`); }
  if (isTanggal(req.query.sampai || "")) { params.push(req.query.sampai); where.push(`tanggal <= $${params.length}`); }
  if (STATUS.includes(req.query.status)) { params.push(req.query.status); where.push(`status = $${params.length}`); }
  if (req.query.cari) {
    params.push("%" + teks(req.query.cari, 100) + "%");
    where.push(`(nama_pelanggan ILIKE $${params.length} OR no_hp ILIKE $${params.length} OR alamat ILIKE $${params.length} OR jenis_acara ILIKE $${params.length})`);
  }
  try {
    const { rows } = await db.query(
      `SELECT * FROM pesanan ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY tanggal, id LIMIT 500`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memuat pesanan." });
  }
});

admin.post("/pesanan", async (req, res) => {
  const { pesanan: p, error } = validasiPesanan(req.body || {});
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await db.query(
      `INSERT INTO pesanan (${KOLOM.join(", ")}, dibuat_oleh)
       VALUES (${KOLOM.map((_, i) => "$" + (i + 1)).join(", ")}, $${KOLOM.length + 1}) RETURNING *`,
      [...nilai(p), req.admin.username]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan pesanan." });
  }
});

admin.put("/pesanan/:id(\\d+)", async (req, res) => {
  const { pesanan: p, error } = validasiPesanan(req.body || {});
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await db.query(
      `UPDATE pesanan SET ${KOLOM.map((k, i) => `${k} = $${i + 1}`).join(", ")}, updated_at = NOW()
       WHERE id = $${KOLOM.length + 1} RETURNING *`,
      [...nilai(p), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan pesanan." });
  }
});

admin.delete("/pesanan/:id(\\d+)", async (req, res) => {
  try {
    const { rowCount } = await db.query("DELETE FROM pesanan WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Pesanan tidak ditemukan." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menghapus pesanan." });
  }
});

// status "otomatis" = hapus pengaturan manual, kembali dihitung dari pesanan.
admin.put("/status-tanggal/:tanggal", async (req, res) => {
  const tanggal = req.params.tanggal;
  const status = teks(req.body && req.body.status, 20);
  if (!isTanggal(tanggal)) return res.status(400).json({ error: "Tanggal tidak valid." });
  try {
    if (status === "otomatis") {
      await db.query("DELETE FROM status_tanggal WHERE tanggal = $1", [tanggal]);
    } else if (STATUS_TANGGAL.includes(status)) {
      await db.query(
        `INSERT INTO status_tanggal (tanggal, status, catatan) VALUES ($1, $2, $3)
         ON CONFLICT (tanggal) DO UPDATE SET status = EXCLUDED.status, catatan = EXCLUDED.catatan, updated_at = NOW()`,
        [tanggal, status, teks(req.body.catatan, 300)]
      );
    } else {
      return res.status(400).json({ error: "Status tidak valid." });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan status tanggal." });
  }
});

module.exports = { publik, admin };
