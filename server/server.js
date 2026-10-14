require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const path = require("path");
const express = require("express");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET belum diisi (minimal 32 karakter). Lihat server/.env.example.");
  process.exit(1);
}

const db = require("./db");
const auth = require("./auth");
const pesanan = require("./pesanan");
const katalog = require("./katalog");

const app = express();
const PORT = Number(process.env.PORT) || 3100;
// Folder website (index.html, admin.html, css, js, assets) = satu tingkat di atas folder server.
const SITE = path.join(__dirname, "..");

// Di belakang Cloudflare Tunnel / reverse proxy, agar req.ip = IP pengunjung asli.
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY === "true" ? true : process.env.TRUST_PROXY);
app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));

app.use("/api/auth", auth.router);
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/admin", pesanan.admin);
app.use("/api/admin", katalog.admin);
app.use("/api", pesanan.publik);
app.use("/api", katalog.publik);
app.use("/api", (req, res) => res.status(404).json({ error: "Tidak ditemukan." }));

// Hanya file website yang disajikan — folder server (berisi .env) tidak ikut.
["css", "js", "assets"].forEach((dir) => app.use("/" + dir, express.static(path.join(SITE, dir))));
app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(SITE, "index.html")));
app.get(["/admin", "/admin.html"], (req, res) => res.sendFile(path.join(SITE, "admin.html")));

async function mulai() {
  await db.ensureDatabase();
  await db.migrate();
  await katalog.seedDariDataJs();

  // Admin pertama dari .env (hanya kalau belum ada admin sama sekali).
  const { rows } = await db.query("SELECT COUNT(*)::int AS n FROM admins");
  if (rows[0].n === 0) {
    if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
      await auth.simpanAdmin(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD, process.env.ADMIN_NAMA);
      console.log(`Admin pertama dibuat: ${process.env.ADMIN_USERNAME.trim().toLowerCase()}`);
    } else {
      console.log("Belum ada admin. Isi ADMIN_USERNAME & ADMIN_PASSWORD di .env lalu restart, atau jalankan: npm run admin:buat -- <username> <password> [nama]");
    }
  }

  app.listen(PORT, () => console.log(`Yudha Entertainment jalan di http://localhost:${PORT} (admin: /admin)`));
}

mulai().catch((err) => {
  console.error("Gagal start:", err.message);
  process.exit(1);
});
