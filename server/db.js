const fs = require("fs");
const path = require("path");
const { Pool, Client, types } = require("pg");

// Kolom DATE dikembalikan apa adanya ("2026-11-07"), bukan Date JS yang bisa bergeser zona waktu.
types.setTypeParser(1082, (v) => v);

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "yudha_entertainment",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || ""
};

const pool = new Pool({ ...config, max: 10 });

// Buat database-nya kalau belum ada (PostgreSQL di NAS sudah dipakai project lain).
async function ensureDatabase() {
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    if (err.code !== "3D000") throw err; // 3D000 = database belum ada
    if (!/^[a-z0-9_]+$/.test(config.database)) throw new Error("DB_NAME hanya boleh huruf kecil, angka, dan _");
    const admin = new Client({ ...config, database: "postgres" });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${config.database}"`);
      console.log(`Database "${config.database}" dibuat.`);
    } finally {
      await admin.end();
    }
  }
}

async function migrate() {
  await pool.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  ensureDatabase,
  migrate
};
