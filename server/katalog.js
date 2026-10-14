const fs = require("fs");
const path = require("path");
const vm = require("vm");
const express = require("express");
const db = require("./db");
const { wajibLogin } = require("./auth");

const teks = (v, max = 200) => String(v == null ? "" : v).trim().slice(0, max);
const angka = (v) => Math.max(0, Math.round(Number(v) || 0));
const slug = (s) => teks(s, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Bentuk data sama dengan window.PAKET / window.PRODUK di js/data.js.
function keFrontend(r) {
  const x = { id: r.id, kategori: r.kategori, nama: r.nama, harga: r.harga, satuan: r.satuan, foto: r.foto, keteranganFoto: r.keterangan_foto };
  if (r.kelipatan > 1) x.kelipatan = r.kelipatan;
  if (r.badge) x.badge = r.badge;
  if (r.tipe === "paket") x.fitur = r.fitur || [];
  return x;
}

// Isi awal dari js/data.js supaya katalog di database sama dengan yang sudah ada.
async function seedDariDataJs() {
  const { rows } = await db.query("SELECT (SELECT COUNT(*) FROM kategori)::int + (SELECT COUNT(*) FROM katalog)::int AS n");
  if (rows[0].n > 0) return;
  const file = path.join(__dirname, "..", "js", "data.js");
  if (!fs.existsSync(file)) return;
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), ctx, { timeout: 1000 });
  const w = ctx.window;
  const kat = (w.KATEGORI || []).filter((k) => k.id !== "all");
  for (let i = 0; i < kat.length; i++) {
    await db.query("INSERT INTO kategori (id, label, urutan) VALUES ($1, $2, $3)", [kat[i].id, kat[i].label, i + 1]);
  }
  const items = (w.PAKET || []).map((x) => ({ ...x, tipe: "paket" })).concat((w.PRODUK || []).map((x) => ({ ...x, tipe: "produk" })));
  for (let i = 0; i < items.length; i++) {
    const x = items[i];
    await db.query(
      `INSERT INTO katalog (id, tipe, kategori, nama, harga, satuan, kelipatan, badge, fitur, foto, keterangan_foto, urutan)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [x.id, x.tipe, x.kategori || "", x.nama, angka(x.harga), x.satuan || "paket", x.kelipatan || 1, x.badge || "",
        JSON.stringify(x.fitur || []), x.foto || "", x.keteranganFoto || "", i + 1]
    );
  }
  console.log(`Katalog awal diisi dari js/data.js: ${kat.length} kategori, ${items.length} paket/produk.`);
}

async function ambilKatalog(semua) {
  const [kat, items] = await Promise.all([
    db.query("SELECT id, label, urutan FROM kategori ORDER BY urutan, label"),
    db.query(`SELECT * FROM katalog ${semua ? "" : "WHERE aktif"} ORDER BY urutan, nama`)
  ]);
  return { kategori: kat.rows, items: items.rows };
}

function validasiItem(b) {
  const x = {
    tipe: b.tipe === "produk" ? "produk" : "paket",
    kategori: teks(b.kategori, 40),
    nama: teks(b.nama, 120),
    harga: angka(b.harga),
    satuan: teks(b.satuan, 30) || "paket",
    kelipatan: Math.max(1, angka(b.kelipatan) || 1),
    badge: teks(b.badge, 40),
    fitur: (Array.isArray(b.fitur) ? b.fitur : []).map((f) => teks(f, 150)).filter(Boolean).slice(0, 30),
    foto: teks(b.foto, 300),
    keterangan_foto: teks(b.keterangan_foto, 100),
    aktif: b.aktif !== false,
    urutan: angka(b.urutan)
  };
  if (!x.nama) return { error: "Nama wajib diisi." };
  if (x.foto && !/^(https:\/\/|assets\/)/.test(x.foto)) return { error: "Foto harus berupa alamat https:// atau file di assets/img/." };
  return { item: x };
}

const KOLOM = ["tipe", "kategori", "nama", "harga", "satuan", "kelipatan", "badge", "fitur", "foto", "keterangan_foto", "aktif", "urutan"];
const nilai = (x) => KOLOM.map((k) => (k === "fitur" ? JSON.stringify(x.fitur) : x[k]));

/* ---------- Publik ---------- */
const publik = express.Router();
publik.get("/katalog.json", async (req, res) => {
  try {
    const { kategori, items } = await ambilKatalog(false);
    res.set({ "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" }).json({
      kategori: kategori.map((k) => ({ id: k.id, label: k.label })),
      paket: items.filter((r) => r.tipe === "paket").map(keFrontend),
      produk: items.filter((r) => r.tipe === "produk").map(keFrontend)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memuat katalog." });
  }
});

/* ---------- Admin ---------- */
const admin = express.Router();
admin.use(wajibLogin);

admin.get("/katalog", async (req, res) => {
  try {
    res.json(await ambilKatalog(true));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memuat katalog." });
  }
});

admin.post("/katalog", async (req, res) => {
  const { item, error } = validasiItem(req.body || {});
  if (error) return res.status(400).json({ error });
  const id = (item.tipe === "paket" ? "p" : "i") + Date.now().toString(36);
  try {
    const { rows } = await db.query(
      `INSERT INTO katalog (id, ${KOLOM.join(", ")}) VALUES ($1, ${KOLOM.map((_, i) => "$" + (i + 2)).join(", ")}) RETURNING *`,
      [id, ...nilai(item)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan." });
  }
});

admin.put("/katalog/:id", async (req, res) => {
  const { item, error } = validasiItem(req.body || {});
  if (error) return res.status(400).json({ error });
  try {
    const { rows } = await db.query(
      `UPDATE katalog SET ${KOLOM.map((k, i) => `${k} = $${i + 1}`).join(", ")}, updated_at = NOW()
       WHERE id = $${KOLOM.length + 1} RETURNING *`,
      [...nilai(item), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Tidak ditemukan." });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan." });
  }
});

admin.delete("/katalog/:id", async (req, res) => {
  try {
    const { rowCount } = await db.query("DELETE FROM katalog WHERE id = $1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "Tidak ditemukan." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menghapus." });
  }
});

admin.post("/kategori", async (req, res) => {
  const label = teks(req.body && req.body.label, 60);
  const id = slug(label);
  if (!label || !id) return res.status(400).json({ error: "Nama kategori wajib diisi." });
  try {
    const { rows } = await db.query(
      `INSERT INTO kategori (id, label, urutan) VALUES ($1, $2, (SELECT COALESCE(MAX(urutan), 0) + 1 FROM kategori))
       ON CONFLICT (id) DO NOTHING RETURNING *`,
      [id, label]
    );
    if (!rows[0]) return res.status(400).json({ error: "Kategori itu sudah ada." });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan kategori." });
  }
});

admin.put("/kategori/:id", async (req, res) => {
  const label = teks(req.body && req.body.label, 60);
  if (!label) return res.status(400).json({ error: "Nama kategori wajib diisi." });
  try {
    const { rows } = await db.query("UPDATE kategori SET label = $1, urutan = $2 WHERE id = $3 RETURNING *",
      [label, angka(req.body.urutan), req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Kategori tidak ditemukan." });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan kategori." });
  }
});

admin.delete("/kategori/:id", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT COUNT(*)::int AS n FROM katalog WHERE kategori = $1", [req.params.id]);
    if (rows[0].n > 0) return res.status(400).json({ error: `Masih ada ${rows[0].n} paket/produk di kategori ini. Pindahkan dulu.` });
    await db.query("DELETE FROM kategori WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menghapus kategori." });
  }
});

module.exports = { publik, admin, seedDariDataJs };
