/* =========================================================
   Logika website pemesanan Yudha Entertainment
   Data & pengaturan ada di js/data.js
   ========================================================= */
(function () {
  "use strict";

  const C = window.CONFIG;
  const ALL = window.PAKET.concat(window.PRODUK);
  const byId = Object.fromEntries(ALL.map((x) => [x.id, x]));
  const STORAGE_KEY = "yudha_pesanan_v1";
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  const $ = (sel) => document.querySelector(sel);
  const rupiah = (n) => "Rp " + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const isoOf = (y, m, d) => y + "-" + pad(m + 1) + "-" + pad(d);

  /* ---------- State ---------- */
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const state = {
    cart: {},          // { id: jumlah }
    cat: "all",
    date: null,        // "YYYY-MM-DD"
    slot: "malam",
    loc: "",
    name: "",
    note: "",
    viewY: today.getFullYear(),
    viewM: today.getMonth()
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return;
      Object.keys(saved.cart || {}).forEach((id) => { if (byId[id]) state.cart[id] = saved.cart[id]; });
      ["slot", "loc", "name", "note"].forEach((k) => { if (typeof saved[k] === "string") state[k] = saved[k]; });
      if (saved.date && dateStatus(saved.date) !== "full" && !isPast(saved.date)) state.date = saved.date;
    } catch (e) { /* abaikan */ }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        cart: state.cart, date: state.date, slot: state.slot, loc: state.loc, name: state.name, note: state.note
      }));
    } catch (e) { /* abaikan */ }
  }

  /* ---------- Tanggal ---------- */
  function minDate() {
    const d = new Date(today);
    d.setDate(d.getDate() + (C.minimalHariPesan || 0));
    return d;
  }
  function isPast(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d) < minDate();
  }
  function dateStatus(iso) {
    if (C.tanggalPenuh.indexOf(iso) >= 0) return "full";
    if (C.tanggalHampirPenuh.indexOf(iso) >= 0) return "near";
    return "ok";
  }
  const STATUS_LABEL = { ok: "Tersedia", near: "Hampir penuh", full: "Penuh" };

  /* ---------- Jadwal dari Google Sheets ---------- */
  // CSV sederhana: dukung kolom berisi koma/kutip ("...").
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  // Terima "2026-11-07", "7/11/2026", "07-11-2026" (hari/bulan/tahun).
  function toISO(s) {
    s = s.trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return m[1] + "-" + pad(+m[2]) + "-" + pad(+m[3]);
    m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (m) return m[3] + "-" + pad(+m[2]) + "-" + pad(+m[1]);
    return null;
  }
  function statusOf(s) {
    s = s.trim().toLowerCase();
    if (/^(penuh|full|booked|terisi)/.test(s)) return "full";
    if (/^(hampir|near)/.test(s)) return "near";
    return null;
  }
  async function loadJadwal() {
    if (!C.jadwalSheetCSV) return;
    const info = $("#calSync");
    try {
      const sep = C.jadwalSheetCSV.indexOf("?") >= 0 ? "&" : "?";
      const res = await fetch(C.jadwalSheetCSV + sep + "t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const full = [], near = [];
      parseCSV(await res.text()).forEach((r) => {
        const iso = toISO(r[0] || ""), st = statusOf(r[1] || "");
        if (iso && st === "full") full.push(iso);
        else if (iso && st === "near") near.push(iso);
      });
      C.tanggalPenuh = full;
      C.tanggalHampirPenuh = near;
      const now = new Date();
      info.textContent = "Jadwal diperbarui pukul " + pad(now.getHours()) + "." + pad(now.getMinutes());
      info.classList.remove("warn");
    } catch (e) {
      info.textContent = "Jadwal terbaru belum bisa dimuat. Ketersediaan akan dikonfirmasi admin lewat WhatsApp.";
      info.classList.add("warn");
    }
    info.hidden = false;
    // tanggal yang sudah dipilih ternyata baru saja penuh
    if (state.date && dateStatus(state.date) === "full") {
      toast("Maaf, " + dateLabel(state.date) + " baru saja penuh. Silakan pilih tanggal lain.");
      state.date = null;
      save();
      renderCart();
    }
    renderCalendar();
  }
  function dateLabel(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return HARI[dt.getDay()] + ", " + d + " " + BULAN[m - 1] + " " + y;
  }

  /* ---------- Keranjang ---------- */
  const stepOf = (id) => byId[id].kelipatan || 1;
  function setQty(id, q) {
    if (q <= 0) delete state.cart[id];
    else state.cart[id] = q;
    save();
    renderCatalog();
    renderCart();
  }
  function cartLines() {
    return Object.keys(state.cart).map((id) => {
      const x = byId[id];
      const q = state.cart[id];
      return { id, x, q, total: x.harga * q };
    });
  }
  function totals() {
    const lines = cartLines();
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const ongkir = lines.length ? C.ongkirEstimasi : 0;
    return { lines, subtotal, ongkir, total: subtotal + ongkir };
  }

  /* ---------- Render: katalog ---------- */
  function renderChips() {
    $("#categoryChips").innerHTML = window.KATEGORI.map((k) =>
      `<button type="button" class="chip" data-action="cat" data-id="${k.id}" aria-pressed="${k.id === state.cat}">${esc(k.label)}</button>`
    ).join("");
  }

  function mediaHTML(x) {
    const img = x.foto ? `<img src="${esc(x.foto)}" alt="${esc(x.nama)}" loading="lazy">` : `<span>[Foto: ${esc(x.keteranganFoto || x.nama)}]</span>`;
    const badge = x.badge ? `<span class="badge">${esc(x.badge)}</span>` : "";
    return `<div class="card-media" data-cat="${x.kategori}">${badge}${img}</div>`;
  }

  function actionHTML(x, small) {
    const q = state.cart[x.id] || 0;
    if (!q) return `<button type="button" class="add-btn" data-action="add" data-id="${x.id}">+ ${small ? "Tambah" : "Tambah ke Pesanan"}</button>`;
    return `<div class="stepper">
      <button type="button" data-action="dec" data-id="${x.id}" aria-label="Kurangi ${esc(x.nama)}">−</button>
      <span>${small ? q : "Di pesanan · " + q}</span>
      <button type="button" class="plus" data-action="inc" data-id="${x.id}" aria-label="Tambah ${esc(x.nama)}">+</button>
    </div>`;
  }

  function renderCatalog() {
    const vis = (x) => state.cat === "all" || x.kategori === state.cat;
    const pk = window.PAKET.filter(vis);
    const it = window.PRODUK.filter(vis);

    $("#packageGrid").innerHTML = pk.map((x) => `
      <article class="card">
        ${mediaHTML(x)}
        <div class="card-body">
          <h3>${esc(x.nama)}</h3>
          <div class="price"><strong>${rupiah(x.harga)}</strong><span>/ ${esc(x.satuan)}</span></div>
          <ul class="features">${(x.fitur || []).map((f) => `<li><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-check"/></svg><span>${esc(f)}</span></li>`).join("")}</ul>
          ${actionHTML(x, false)}
        </div>
      </article>`).join("");

    $("#itemGrid").innerHTML = it.map((x) => `
      <article class="card card-sm">
        ${mediaHTML(x)}
        <div class="card-body">
          <h3>${esc(x.nama)}</h3>
          <div class="price"><strong>${rupiah(x.harga)}</strong><span>/ ${esc(x.satuan)}</span></div>
          <span class="card-note">${x.kelipatan ? "Ditambah per " + x.kelipatan + " " + esc(x.satuan) : "Bisa digabung dengan paket"}</span>
          ${actionHTML(x, true)}
        </div>
      </article>`).join("");

    $("#packageEmpty").hidden = pk.length > 0;
    $("#itemEmpty").hidden = it.length > 0;
    $("#paket").hidden = pk.length === 0 && state.cat !== "all";
    $("#produk").hidden = it.length === 0 && state.cat !== "all";
  }

  /* ---------- Render: panel pesanan ---------- */
  function renderCart() {
    const t = totals();
    const list = $("#cartList");
    if (!t.lines.length) {
      list.innerHTML = `<p class="cart-empty">Belum ada barang. Tekan <b>+ Tambah</b> pada paket atau produk.</p>`;
    } else {
      list.innerHTML = t.lines.map((l) => `
        <div class="cart-row">
          <div class="cart-info">
            <div class="cart-name">${esc(l.x.nama)}</div>
            <div class="cart-line">${rupiah(l.x.harga)} × ${l.q} = ${rupiah(l.total)}</div>
          </div>
          <div class="mini-stepper">
            <button type="button" data-action="dec" data-id="${l.id}" aria-label="Kurangi">−</button>
            <span>${l.q}</span>
            <button type="button" data-action="inc" data-id="${l.id}" aria-label="Tambah">+</button>
          </div>
          <button type="button" class="remove-btn" data-action="remove" data-id="${l.id}" aria-label="Hapus ${esc(l.x.nama)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-trash"/></svg>
          </button>
        </div>`).join("");
      $("#errCart").hidden = true;
    }
    $("#lineCount").textContent = t.lines.length + " item";
    $("#sumSubtotal").textContent = rupiah(t.subtotal);
    $("#sumOngkir").textContent = rupiah(t.ongkir);
    $("#sumTotal").textContent = rupiah(t.total);

    // bar bawah mobile
    const meta = [];
    meta.push(t.lines.length ? t.lines.length + " item" : "Belum ada barang");
    if (state.date) {
      const [, m, d] = state.date.split("-").map(Number);
      meta.push(d + " " + BULAN[m - 1].slice(0, 3) + ", " + slotOf().label);
    }
    $("#barMeta").textContent = meta.join(" · ");
    $("#barTotal").textContent = rupiah(t.total);

    renderMessage();
  }

  function renderCalendar() {
    const y = state.viewY, m = state.viewM;
    $("#calTitle").textContent = BULAN[m] + " " + y;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    let html = "";
    for (let i = 0; i < first; i++) html += `<span class="day-blank"></span>`;
    for (let d = 1; d <= days; d++) {
      const iso = isoOf(y, m, d);
      const past = isPast(iso);
      const st = dateStatus(iso);
      const cls = ["day"];
      if (past) cls.push("past");
      else if (st !== "ok") cls.push(st);
      if (iso === state.date) cls.push("selected");
      const disabled = past || st === "full";
      const label = d + " " + BULAN[m] + ", " + (past ? "tidak bisa dipilih" : STATUS_LABEL[st].toLowerCase());
      html += `<button type="button" class="${cls.join(" ")}" data-action="date" data-id="${iso}" ${disabled ? "disabled" : ""} aria-pressed="${iso === state.date}" aria-label="${label}">${d}</button>`;
    }
    $("#calDays").innerHTML = html;

    // tombol bulan sebelumnya tidak bisa lewat dari bulan ini
    $("#calPrev").disabled = (y === today.getFullYear() && m <= today.getMonth());

    const sel = $("#selectedDate");
    if (state.date) {
      const st = dateStatus(state.date);
      sel.innerHTML = `<b>${dateLabel(state.date)}</b> <span class="st">· ${STATUS_LABEL[st]}${st === "near" ? ", segera pesan" : ""}</span>`;
    } else {
      sel.textContent = "Belum memilih tanggal";
    }
  }

  const slotOf = () => window.WAKTU.filter((w) => w.id === state.slot)[0] || window.WAKTU[0];
  function renderSlots() {
    $("#slotGroup").innerHTML = window.WAKTU.map((w) =>
      `<button type="button" class="slot" data-action="slot" data-id="${w.id}" aria-pressed="${w.id === state.slot}"><b>${w.label}</b><small>${w.jam}</small></button>`
    ).join("");
  }

  function buildMessage() {
    const t = totals();
    const slot = slotOf();
    const lines = t.lines.map((l) => "- " + l.x.nama + " x" + l.q + " = " + rupiah(l.total)).join("\n");
    let msg = "Halo " + C.namaUsaha + ", saya ingin pesan:\n" + (lines || "- (belum ada barang)");
    msg += "\n\nTanggal: " + (state.date ? dateLabel(state.date) : "[belum dipilih]") + " (" + slot.label + ", " + slot.jam + ")";
    msg += "\nLokasi: " + (state.loc.trim() || "[belum diisi]");
    if (state.name.trim()) msg += "\nNama: " + state.name.trim();
    if (state.note.trim()) msg += "\nCatatan: " + state.note.trim();
    msg += "\n\nSubtotal: " + rupiah(t.subtotal);
    msg += "\nEstimasi ongkir: " + rupiah(t.ongkir);
    msg += "\nEstimasi total: " + rupiah(t.total);
    msg += "\n\nMohon konfirmasi ketersediaannya. Terima kasih.";
    return msg;
  }
  function renderMessage() {
    $("#msgPreview").textContent = buildMessage();
  }

  /* ---------- Bottom sheet (mobile) ---------- */
  const isMobile = () => window.matchMedia("(max-width: 1023px)").matches;
  function openSheet() {
    if (!isMobile()) { $("#pesan").scrollIntoView({ behavior: "smooth" }); return; }
    $("#pesan").classList.add("open");
    $("#backdrop").hidden = false;
    document.body.classList.add("sheet-open");
    $("#sheetClose").focus();
  }
  function closeSheet() {
    $("#pesan").classList.remove("open");
    $("#backdrop").hidden = true;
    document.body.classList.remove("sheet-open");
  }

  let toastTimer;
  function toast(text) {
    const el = $("#toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  /* ---------- Kirim WA ---------- */
  function sendWA() {
    const t = totals();
    let ok = true;
    $("#errCart").hidden = t.lines.length > 0;
    $("#errDate").hidden = !!state.date;
    $("#errLoc").hidden = !!state.loc.trim();
    $("#inputLoc").classList.toggle("invalid", !state.loc.trim());
    if (!t.lines.length || !state.date || !state.loc.trim()) ok = false;
    if (!ok) {
      openSheet();
      const firstErr = document.querySelector(".field-error:not([hidden])");
      if (firstErr) firstErr.scrollIntoView({ behavior: "smooth", block: "center" });
      toast("Lengkapi dulu pesanan Anda");
      return;
    }
    const url = "https://wa.me/" + C.nomorWA + "?text=" + encodeURIComponent(buildMessage());
    window.open(url, "_blank", "noopener");
  }

  /* ---------- Event ---------- */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    switch (btn.dataset.action) {
      case "cat":
        state.cat = id; renderChips(); renderCatalog(); break;
      case "add":
        setQty(id, stepOf(id)); toast(byId[id].nama + " ditambahkan"); break;
      case "inc":
        setQty(id, (state.cart[id] || 0) + stepOf(id)); break;
      case "dec":
        setQty(id, (state.cart[id] || 0) - stepOf(id)); break;
      case "remove":
        setQty(id, 0); break;
      case "date":
        state.date = id; $("#errDate").hidden = true; save(); renderCalendar(); renderCart(); break;
      case "slot":
        state.slot = id; save(); renderSlots(); renderCart(); break;
    }
  });

  $("#calPrev").addEventListener("click", () => {
    state.viewM--; if (state.viewM < 0) { state.viewM = 11; state.viewY--; } renderCalendar();
  });
  $("#calNext").addEventListener("click", () => {
    state.viewM++; if (state.viewM > 11) { state.viewM = 0; state.viewY++; } renderCalendar();
  });

  const bindInput = (sel, key) => {
    const el = $(sel);
    el.value = state[key];
    el.addEventListener("input", () => {
      state[key] = el.value;
      if (key === "loc" && el.value.trim()) { $("#errLoc").hidden = true; el.classList.remove("invalid"); }
      save(); renderMessage();
    });
  };
  bindInput("#inputLoc", "loc");
  bindInput("#inputName", "name");
  bindInput("#inputNote", "note");

  $("#toggleMsg").addEventListener("click", (e) => {
    const pre = $("#msgPreview");
    pre.hidden = !pre.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!pre.hidden));
    e.currentTarget.textContent = pre.hidden ? "Lihat isi pesan WhatsApp" : "Sembunyikan isi pesan WhatsApp";
  });
  $("#sendWA").addEventListener("click", sendWA);
  $("#openSheet").addEventListener("click", openSheet);
  $("#sheetClose").addEventListener("click", closeSheet);
  $("#backdrop").addEventListener("click", closeSheet);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
  $("#heroCheckDate").addEventListener("click", (e) => { if (isMobile()) { e.preventDefault(); openSheet(); } });
  window.addEventListener("resize", () => { if (!isMobile()) closeSheet(); });

  /* ---------- Isi teks dari CONFIG ---------- */
  function applyConfig() {
    document.querySelectorAll("[data-config]").forEach((el) => {
      const v = C[el.dataset.config];
      if (v !== undefined) el.textContent = v;
    });
    const tel = "tel:" + C.nomorTelepon;
    ["#headerCall", "#panelCall", "#footerCall"].forEach((s) => { $(s).href = tel; });
    $("#footerCall").textContent = "Telepon: " + C.nomorTelepon;
    $("#footerWA").href = "https://wa.me/" + C.nomorWA;
    $("#footerWA").textContent = "WhatsApp: +" + C.nomorWA;
    $("#year").textContent = today.getFullYear();
  }

  /* ---------- Mulai ---------- */
  load();
  if (state.date) {
    const [y, m] = state.date.split("-").map(Number);
    state.viewY = y; state.viewM = m - 1;
  }
  applyConfig();
  renderChips();
  renderCatalog();
  renderSlots();
  renderCalendar();
  renderCart();

  // ambil jadwal saat dibuka, tiap 2 menit, dan saat pelanggan kembali ke tab ini
  loadJadwal();
  setInterval(loadJadwal, 2 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) loadJadwal(); });
})();
