const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || "12h";

function wajibLogin(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return res.status(401).json({ error: "Silakan login." });
  try {
    req.admin = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Sesi habis, silakan login lagi." });
  }
}

// Kunci sementara setelah 5x salah password (per username, dari IP mana pun).
const gagal = new Map();
const MAKS_GAGAL = 5;
const KUNCI_MS = 10 * 60 * 1000;
function terkunci(key) {
  const g = gagal.get(key);
  if (!g) return false;
  if (g.sampai && g.sampai > Date.now()) return true;
  if (g.sampai) gagal.delete(key);
  return false;
}
function catatGagal(key) {
  const g = gagal.get(key) || { n: 0, sampai: 0 };
  g.n++;
  if (g.n >= MAKS_GAGAL) g.sampai = Date.now() + KUNCI_MS;
  gagal.set(key, g);
}

const router = express.Router();

router.post("/login", async (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!username || !password) return res.status(400).json({ error: "Username dan password wajib diisi." });

  const key = username;
  if (terkunci(key)) return res.status(429).json({ error: "Terlalu banyak percobaan. Coba lagi 10 menit lagi." });

  try {
    const { rows } = await db.query("SELECT * FROM admins WHERE username = $1 AND aktif", [username]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      catatGagal(key);
      return res.status(401).json({ error: "Username atau password salah." });
    }
    gagal.delete(key);
    const payload = { id: admin.id, username: admin.username, nama: admin.nama };
    res.json({ token: jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES }), admin: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal login, coba lagi." });
  }
});

router.get("/me", wajibLogin, (req, res) => res.json(req.admin));

router.put("/password", wajibLogin, async (req, res) => {
  const lama = String(req.body.lama || "");
  const baru = String(req.body.baru || "");
  if (baru.length < 8) return res.status(400).json({ error: "Password baru minimal 8 karakter." });
  try {
    const { rows } = await db.query("SELECT password_hash FROM admins WHERE id = $1", [req.admin.id]);
    if (!rows[0] || !(await bcrypt.compare(lama, rows[0].password_hash))) {
      return res.status(401).json({ error: "Password lama salah." });
    }
    await db.query("UPDATE admins SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(baru, 10), req.admin.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengganti password." });
  }
});

async function simpanAdmin(username, password, nama) {
  const hash = await bcrypt.hash(password, 10);
  await db.query(
    `INSERT INTO admins (username, password_hash, nama) VALUES ($1, $2, $3)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, nama = EXCLUDED.nama, aktif = TRUE`,
    [username.trim().toLowerCase(), hash, nama || username]
  );
}

module.exports = { router, wajibLogin, simpanAdmin };
