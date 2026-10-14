// Tambah admin baru atau reset password admin yang sudah ada.
// Pakai: npm run admin:buat -- <username> <password> [nama lengkap]
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const db = require("../db");
const { simpanAdmin } = require("../auth");

(async () => {
  const [username, password, ...nama] = process.argv.slice(2);
  if (!username || !password) {
    console.log("Pakai: npm run admin:buat -- <username> <password> [nama lengkap]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.log("Password minimal 8 karakter.");
    process.exit(1);
  }
  await db.ensureDatabase();
  await db.migrate();
  await simpanAdmin(username, password, nama.join(" "));
  console.log(`Admin "${username.toLowerCase()}" disimpan.`);
  await db.pool.end();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
