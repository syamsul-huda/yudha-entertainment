/* =========================================================
   Halaman admin Yudha Entertainment
   Data pesanan disimpan di server NAS (folder server/).
   ========================================================= */
(function () {
  "use strict";

  const C = window.CONFIG;
  const TOKEN_KEY = "yudha_admin_token";
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const SESI = window.WAKTU.map((w) => ({ id: w.id, label: w.label + " (" + w.jam + ")" }))
    .concat([{ id: "seharian", label: "Seharian" }]);
  const STATUS_LABEL = { menunggu: "Menunggu", dikonfirmasi: "Dikonfirmasi", selesai: "Selesai", batal: "Batal" };
  const TGL_LABEL = { ok: "Tersedia", tersedia: "Tersedia", hampir: "Hampir penuh", penuh: "Penuh" };
  // Diisi dari server (tab Katalog); sebelum termuat pakai data.js.
  let KATALOG = window.PAKET.map((x) => ({ ...x, tipe: "paket" })).concat(window.PRODUK.map((x) => ({ ...x, tipe: "produk" })));
  let KATEGORI = window.KATEGORI.filter((k) => k.id !== "all");

  const $ = (sel, root) => (root || document).querySelector(sel);
  const rupiah = (n) => "Rp " + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const isoOf = (y, m, d) => y + "-" + pad(m + 1) + "-" + pad(d);
  const now = new Date();
  const todayISO = isoOf(now.getFullYear(), now.getMonth(), now.getDate());
  function dateLabel(iso, withYear) {
    const [y, m, d] = iso.split("-").map(Number);
    return HARI[new Date(y, m - 1, d).getDay()] + ", " + d + " " + BULAN[m - 1] + (withYear === false ? "" : " " + y);
  }
  const sesiLabel = (id) => (SESI.filter((s) => s.id === id)[0] || { label: id }).label;
  function waLink(hp) {
    let n = String(hp || "").replace(/\D/g, "");
    if (n.startsWith("0")) n = "62" + n.slice(1);
    return n.length >= 9 ? "https://wa.me/" + n : "";
  }

  let toastTimer;
  function toast(text) {
    const el = $("#toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ---------- API ---------- */
  let token = null;
  try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { /* abaikan */ }

  async function api(path, opts) {
    opts = opts || {};
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    let res;
    try {
      res = await fetch("api/" + path, { method: opts.method || "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    } catch (e) {
      throw new Error("Server tidak bisa dihubungi. Cek koneksi / server NAS.");
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== "auth/login") { logout(); throw new Error(data.error || "Silakan login."); }
    if (!res.ok) throw new Error(data.error || "Terjadi kesalahan (" + res.status + ").");
    return data;
  }

  /* ---------- Login ---------- */
  function showLogin() {
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    $("#loginUser").focus();
  }
  function setToken(t) {
    token = t;
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* abaikan */ }
  }
  function logout() {
    setToken(null);
    showLogin();
  }
  async function showApp(admin) {
    $("#adminName").textContent = admin.nama || admin.username;
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    loadKatalogAdmin();
    await loadMonth();
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#loginErr");
    err.hidden = true;
    $("#loginBtn").disabled = true;
    try {
      const r = await api("auth/login", { method: "POST", body: { username: $("#loginUser").value, password: $("#loginPass").value } });
      setToken(r.token);
      $("#loginPass").value = "";
      await showApp(r.admin);
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      $("#loginBtn").disabled = false;
    }
  });
  $("#logoutBtn").addEventListener("click", logout);

  /* ---------- Tab ---------- */
  document.querySelectorAll(".adm-tab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".adm-tab").forEach((x) => x.setAttribute("aria-selected", String(x === t)));
    const tab = t.dataset.tab;
    $("#tabKalender").hidden = tab !== "kalender";
    $("#tabDaftar").hidden = tab !== "daftar";
    $("#tabKatalog").hidden = tab !== "katalog";
    if (tab === "kalender") loadMonth();
    else if (tab === "daftar") loadList();
    else loadKatalogAdmin();
  }));

  /* ---------- Kalender ---------- */
  const cal = { y: now.getFullYear(), m: now.getMonth(), selected: todayISO, status: {}, pesanan: {} };

  async function loadMonth() {
    const last = new Date(cal.y, cal.m + 1, 0).getDate();
    try {
      const r = await api("admin/kalender?dari=" + isoOf(cal.y, cal.m, 1) + "&sampai=" + isoOf(cal.y, cal.m, last));
      cal.status = {};
      r.status.forEach((s) => { cal.status[s.tanggal] = s; });
      cal.pesanan = {};
      r.pesanan.forEach((p) => { (cal.pesanan[p.tanggal] = cal.pesanan[p.tanggal] || []).push(p); });
    } catch (ex) {
      toast(ex.message);
    }
    renderMonth();
    renderDay();
  }

  function renderMonth() {
    const y = cal.y, m = cal.m;
    $("#admMonth").textContent = BULAN[m] + " " + y;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    let html = "";
    for (let i = 0; i < first; i++) html += "<span></span>";
    for (let d = 1; d <= days; d++) {
      const iso = isoOf(y, m, d);
      const st = cal.status[iso];
      const aktif = (cal.pesanan[iso] || []).filter((p) => p.status !== "batal").length;
      const cls = ["adm-day-cell"];
      if (st && st.status === "penuh") cls.push("full");
      else if (st && st.status === "hampir") cls.push("near");
      if (iso < todayISO) cls.push("past");
      if (iso === todayISO) cls.push("today");
      const label = d + " " + BULAN[m] + ", " + TGL_LABEL[st ? st.status : "ok"] + (aktif ? ", " + aktif + " pesanan" : "");
      html += `<button type="button" class="${cls.join(" ")}" data-date="${iso}" aria-pressed="${iso === cal.selected}" aria-label="${label}">` +
        `<span>${d}</span>${st && st.manual ? '<span class="m" title="Diatur manual">✎</span>' : ""}${aktif ? `<span class="n">${aktif}</span>` : ""}</button>`;
    }
    $("#admDays").innerHTML = html;
  }

  function orderCard(p) {
    const items = (p.barang || []).map((x) => esc(x.nama) + " ×" + x.qty).join(", ");
    const sisa = Math.max(0, p.total - p.dp);
    const wa = waLink(p.no_hp);
    return `<article class="adm-order" data-status="${p.status}">
      <div class="adm-order-top">
        <h3>${esc(p.nama_pelanggan)}</h3>
        <span class="st-pill st-${p.status}">${STATUS_LABEL[p.status]}</span>
      </div>
      <div class="adm-meta">
        <span>${esc(p.jenis_acara || "Acara")} · ${esc(sesiLabel(p.sesi))}</span>
        ${p.no_hp ? `<span>☎ ${esc(p.no_hp)}</span>` : ""}
        ${p.jam_pasang ? `<span>Pasang: ${esc(p.jam_pasang)}</span>` : ""}
        ${p.jam_bongkar ? `<span>Bongkar: ${esc(p.jam_bongkar)}</span>` : ""}
      </div>
      ${p.alamat ? `<div class="adm-meta">📍 ${esc(p.alamat)}</div>` : ""}
      ${items ? `<div class="adm-items">${items}</div>` : ""}
      <div class="adm-money">
        <span>Total <b>${rupiah(p.total)}</b></span>
        <span>DP <b>${rupiah(p.dp)}</b></span>
        ${sisa ? `<span class="sisa">Sisa ${rupiah(sisa)}</span>` : `<span class="lunas">Lunas</span>`}
      </div>
      ${p.catatan ? `<div class="adm-note">${esc(p.catatan)}</div>` : ""}
      <div class="adm-order-actions">
        <button type="button" class="btn btn-outline btn-sm" data-edit="${p.id}">Lihat / ubah</button>
        ${wa ? `<a class="btn btn-wa btn-sm" href="${wa}" target="_blank" rel="noopener">Chat WA</a>` : ""}
      </div>
    </article>`;
  }

  function renderDay() {
    const iso = cal.selected;
    const panel = $("#dayPanel");
    if (!iso || iso.slice(0, 7) !== isoOf(cal.y, cal.m, 1).slice(0, 7)) {
      panel.innerHTML = `<p class="adm-empty">Pilih tanggal di kalender untuk melihat detail acara.</p>`;
      return;
    }
    const st = cal.status[iso];
    const list = cal.pesanan[iso] || [];
    const manual = st && st.manual ? st.status : "otomatis";
    panel.innerHTML = `
      <h2>${dateLabel(iso)}</h2>
      <div class="adm-day-status">
        <span>Di website tampil: <b>${TGL_LABEL[st ? st.status : "ok"]}</b>${st && st.manual ? " (diatur manual)" : ""}</span>
        <label>Atur status tanggal
          <select id="dayStatus">
            <option value="otomatis">Otomatis dari pesanan</option>
            <option value="tersedia">Paksa tersedia</option>
            <option value="hampir">Hampir penuh</option>
            <option value="penuh">Penuh (tutup tanggal)</option>
          </select>
        </label>
      </div>
      ${list.length ? `<div class="adm-orders">${list.map(orderCard).join("")}</div>` : `<p class="adm-empty">Belum ada pesanan di tanggal ini.</p>`}
      <button type="button" class="btn btn-primary btn-block" id="addOnDay">+ Tambah pesanan tanggal ini</button>`;
    $("#dayStatus").value = manual;
  }

  $("#admDays").addEventListener("click", (e) => {
    const b = e.target.closest("[data-date]");
    if (!b) return;
    cal.selected = b.dataset.date;
    renderMonth();
    renderDay();
    if (window.innerWidth < 1024) $("#dayPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  const shiftMonth = (n) => {
    cal.m += n;
    if (cal.m < 0) { cal.m = 11; cal.y--; }
    if (cal.m > 11) { cal.m = 0; cal.y++; }
    loadMonth();
  };
  $("#admPrev").addEventListener("click", () => shiftMonth(-1));
  $("#admNext").addEventListener("click", () => shiftMonth(1));
  $("#admToday").addEventListener("click", () => {
    cal.y = now.getFullYear(); cal.m = now.getMonth(); cal.selected = todayISO; loadMonth();
  });

  $("#dayPanel").addEventListener("change", async (e) => {
    if (e.target.id !== "dayStatus") return;
    try {
      await api("admin/status-tanggal/" + cal.selected, { method: "PUT", body: { status: e.target.value } });
      toast("Status tanggal disimpan");
    } catch (ex) {
      toast(ex.message);
    }
    loadMonth();
  });
  $("#dayPanel").addEventListener("click", (e) => {
    if (e.target.id === "addOnDay") openOrder(null, cal.selected);
  });

  /* ---------- Daftar pesanan ---------- */
  let listCache = [];
  async function loadList() {
    const q = [];
    if ($("#fMendatang").checked) q.push("dari=" + todayISO);
    if ($("#fStatus").value) q.push("status=" + $("#fStatus").value);
    if ($("#fCari").value.trim()) q.push("cari=" + encodeURIComponent($("#fCari").value.trim()));
    const out = $("#listOut");
    try {
      listCache = await api("admin/pesanan" + (q.length ? "?" + q.join("&") : ""));
    } catch (ex) {
      out.innerHTML = `<p class="adm-empty">${esc(ex.message)}</p>`;
      return;
    }
    if (!listCache.length) {
      out.innerHTML = `<p class="adm-empty">Tidak ada pesanan yang cocok.</p>`;
      return;
    }
    const groups = {};
    listCache.forEach((p) => { (groups[p.tanggal] = groups[p.tanggal] || []).push(p); });
    out.innerHTML = Object.keys(groups).map((iso) =>
      `<section class="adm-date-group"><h3>${dateLabel(iso)}</h3><div class="adm-orders">${groups[iso].map(orderCard).join("")}</div></section>`
    ).join("");
  }
  let cariTimer;
  $("#fCari").addEventListener("input", () => { clearTimeout(cariTimer); cariTimer = setTimeout(loadList, 300); });
  $("#fStatus").addEventListener("change", loadList);
  $("#fMendatang").addEventListener("change", loadList);
  $("#newOrderBtn").addEventListener("click", () => openOrder(null, ""));

  // tombol "Lihat / ubah" di kalender maupun daftar
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-edit]");
    if (!b) return;
    const id = Number(b.dataset.edit);
    const all = listCache.concat(...Object.values(cal.pesanan));
    const p = all.filter((x) => x.id === id)[0];
    if (p) openOrder(p);
  });

  /* ---------- Form pesanan ---------- */
  const dlg = $("#orderDlg");
  const form = $("#orderForm");
  let editing = null;

  $("#oSesi").innerHTML = SESI.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join("");
  function buildPicker() {
    const opt = (x) => `<option value="${esc(x.id)}">${esc(x.nama)} — ${rupiah(x.harga)}/${esc(x.satuan)}</option>`;
    const aktif = KATALOG.filter((x) => x.aktif !== false);
    $("#katalogPick").innerHTML = `<option value="">+ Tambah dari katalog…</option>` +
      `<optgroup label="Paket">${aktif.filter((x) => x.tipe === "paket").map(opt).join("")}</optgroup>` +
      `<optgroup label="Satuan">${aktif.filter((x) => x.tipe === "produk").map(opt).join("")}</optgroup>`;
    $("#katalogList").innerHTML = aktif.map((x) => `<option value="${esc(x.nama)}">`).join("");
  }
  buildPicker();

  function itemRow(x) {
    const div = document.createElement("div");
    div.className = "adm-item";
    div.innerHTML = `<input class="i-nama" list="katalogList" placeholder="Nama barang" aria-label="Nama barang">
      <input class="i-qty" type="number" min="1" inputmode="numeric" aria-label="Jumlah">
      <input class="i-harga" type="number" min="0" step="500" inputmode="numeric" aria-label="Harga satuan">
      <button type="button" class="remove-btn" aria-label="Hapus barang">✕</button>
      <span class="sub"></span>`;
    $(".i-nama", div).value = x.nama || "";
    $(".i-qty", div).value = x.qty || 1;
    $(".i-harga", div).value = x.harga || 0;
    $("#itemRows").appendChild(div);
  }
  function readItems() {
    return Array.from(document.querySelectorAll("#itemRows .adm-item")).map((r) => ({
      nama: $(".i-nama", r).value.trim(),
      qty: Math.max(0, Math.round(Number($(".i-qty", r).value) || 0)),
      harga: Math.max(0, Math.round(Number($(".i-harga", r).value) || 0))
    }));
  }
  function updateSum() {
    document.querySelectorAll("#itemRows .adm-item").forEach((r) => {
      const q = Number($(".i-qty", r).value) || 0, h = Number($(".i-harga", r).value) || 0;
      $(".sub", r).textContent = q && h ? "Subtotal " + rupiah(q * h) : "";
    });
    const sub = readItems().filter((x) => x.nama && x.qty).reduce((s, x) => s + x.qty * x.harga, 0);
    const ongkir = Number(form.ongkir.value) || 0, dp = Number(form.dp.value) || 0;
    const total = sub + ongkir;
    $("#orderSum").innerHTML =
      `<dt>Barang & paket</dt><dd>${rupiah(sub)}</dd><dt>Ongkir</dt><dd>${rupiah(ongkir)}</dd>` +
      `<dt>Total</dt><dd class="total">${rupiah(total)}</dd><dt>DP</dt><dd>${rupiah(dp)}</dd>` +
      `<dt>Sisa pelunasan</dt><dd>${rupiah(Math.max(0, total - dp))}</dd>`;
  }

  $("#katalogPick").addEventListener("change", (e) => {
    const x = KATALOG.filter((k) => k.id === e.target.value)[0];
    if (x) { itemRow({ nama: x.nama, qty: x.kelipatan || 1, harga: x.harga }); updateSum(); }
    e.target.value = "";
  });
  $("#addItem").addEventListener("click", () => { itemRow({}); updateSum(); $("#itemRows .adm-item:last-child .i-nama").focus(); });
  $("#itemRows").addEventListener("click", (e) => {
    if (e.target.closest(".remove-btn")) { e.target.closest(".adm-item").remove(); updateSum(); }
  });
  // isi harga otomatis saat nama barang cocok dengan katalog
  $("#itemRows").addEventListener("change", (e) => {
    if (!e.target.classList.contains("i-nama")) return;
    const row = e.target.closest(".adm-item");
    const x = KATALOG.filter((k) => k.nama.toLowerCase() === e.target.value.trim().toLowerCase())[0];
    if (x && !Number($(".i-harga", row).value)) { $(".i-harga", row).value = x.harga; updateSum(); }
  });
  form.addEventListener("input", updateSum);

  function openOrder(p, tanggal) {
    editing = p;
    form.reset();
    $("#orderErr").hidden = true;
    $("#itemRows").innerHTML = "";
    $("#orderTitle").textContent = p ? "Detail pesanan #" + p.id : "Pesanan baru";
    $("#deleteOrder").hidden = !p;
    const v = p || { tanggal: tanggal || "", sesi: "malam", status: "menunggu", ongkir: C.ongkirEstimasi || 0, dp: 0, barang: [] };
    ["tanggal", "sesi", "jenis_acara", "jam_pasang", "jam_bongkar", "nama_pelanggan", "no_hp", "alamat", "ongkir", "dp", "status", "catatan"]
      .forEach((k) => { if (form[k]) form[k].value = v[k] == null ? "" : v[k]; });
    (v.barang || []).forEach(itemRow);
    if (!(v.barang || []).length) itemRow({});
    updateSum();
    dlg.showModal();
  }
  dlg.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) dlg.close(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#orderErr");
    const body = {};
    ["tanggal", "sesi", "jenis_acara", "jam_pasang", "jam_bongkar", "nama_pelanggan", "no_hp", "alamat", "status", "catatan"]
      .forEach((k) => { body[k] = form[k].value; });
    body.ongkir = Number(form.ongkir.value) || 0;
    body.dp = Number(form.dp.value) || 0;
    body.barang = readItems().filter((x) => x.nama && x.qty);
    if (!body.tanggal || !body.nama_pelanggan.trim()) {
      err.textContent = "Tanggal acara dan nama pelanggan wajib diisi.";
      err.hidden = false;
      return;
    }
    // peringatan kalau tanggal sudah penuh oleh pesanan lain
    const st = cal.status[body.tanggal];
    const pindah = !editing || editing.tanggal !== body.tanggal;
    if (pindah && st && st.status === "penuh" && body.status !== "batal" &&
        !confirm(dateLabel(body.tanggal) + " sudah PENUH. Tetap simpan pesanan di tanggal ini?")) return;
    $("#saveOrder").disabled = true;
    try {
      const saved = await api("admin/pesanan" + (editing ? "/" + editing.id : ""), { method: editing ? "PUT" : "POST", body });
      dlg.close();
      toast("Pesanan " + saved.nama_pelanggan + " disimpan");
      const [y, m] = saved.tanggal.split("-").map(Number);
      cal.y = y; cal.m = m - 1; cal.selected = saved.tanggal;
      await loadMonth();
      if (!$("#tabDaftar").hidden) loadList();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      $("#saveOrder").disabled = false;
    }
  });

  $("#deleteOrder").addEventListener("click", async () => {
    if (!editing || !confirm("Hapus pesanan " + editing.nama_pelanggan + "? Data tidak bisa dikembalikan.\n\nKalau acaranya batal, sebaiknya ubah status jadi \"Batal\" saja.")) return;
    try {
      await api("admin/pesanan/" + editing.id, { method: "DELETE" });
      dlg.close();
      toast("Pesanan dihapus");
      await loadMonth();
      if (!$("#tabDaftar").hidden) loadList();
    } catch (ex) {
      toast(ex.message);
    }
  });

  /* ---------- Katalog (kategori, paket, produk) ---------- */
  async function loadKatalogAdmin() {
    try {
      const r = await api("admin/katalog");
      KATEGORI = r.kategori;
      KATALOG = r.items.map((x) => ({ ...x, keteranganFoto: x.keterangan_foto }));
      buildPicker();
      renderKatalogAdmin();
    } catch (ex) {
      if (!$("#tabKatalog").hidden) toast(ex.message);
    }
  }
  const katLabel = (id) => (KATEGORI.filter((k) => k.id === id)[0] || { label: id ? id + " (terhapus)" : "Tanpa kategori" }).label;

  function renderKatalogAdmin() {
    $("#katList").innerHTML = KATEGORI.map((k) => {
      const n = KATALOG.filter((x) => x.kategori === k.id).length;
      return `<span class="adm-kat-chip">${esc(k.label)} <small>(${n})</small>
        <button type="button" data-kat-rename="${esc(k.id)}" aria-label="Ganti nama ${esc(k.label)}" title="Ganti nama">✎</button>
        <button type="button" data-kat-del="${esc(k.id)}" aria-label="Hapus ${esc(k.label)}" title="Hapus">✕</button></span>`;
    }).join("") || `<p class="adm-empty">Belum ada kategori.</p>`;
    const card = (x) => `<button type="button" class="adm-cat-item${x.aktif ? "" : " off"}" data-item="${esc(x.id)}">
        ${x.aktif ? "" : `<span class="adm-off-tag">Disembunyikan</span>`}
        <b>${esc(x.nama)}</b>
        <span><span class="harga">${rupiah(x.harga)}</span> / ${esc(x.satuan)}${x.kelipatan > 1 ? " · per " + x.kelipatan : ""}</span>
        <span class="meta">${esc(katLabel(x.kategori))}${x.badge ? " · " + esc(x.badge) : ""}</span>
        ${x.tipe === "paket" && x.fitur.length ? `<ul>${x.fitur.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
      </button>`;
    const pk = KATALOG.filter((x) => x.tipe === "paket"), pr = KATALOG.filter((x) => x.tipe === "produk");
    $("#paketList").innerHTML = pk.map(card).join("") || `<p class="adm-empty">Belum ada paket.</p>`;
    $("#produkList").innerHTML = pr.map(card).join("") || `<p class="adm-empty">Belum ada produk.</p>`;
  }

  $("#katForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const label = $("#katBaru").value.trim();
    if (!label) return;
    try {
      await api("admin/kategori", { method: "POST", body: { label } });
      $("#katBaru").value = "";
      toast("Kategori ditambahkan");
      loadKatalogAdmin();
    } catch (ex) { toast(ex.message); }
  });
  $("#katList").addEventListener("click", async (e) => {
    const ren = e.target.closest("[data-kat-rename]"), del = e.target.closest("[data-kat-del]");
    try {
      if (ren) {
        const k = KATEGORI.filter((x) => x.id === ren.dataset.katRename)[0];
        const label = prompt("Nama baru kategori:", k.label);
        if (!label || !label.trim()) return;
        await api("admin/kategori/" + encodeURIComponent(k.id), { method: "PUT", body: { label: label.trim(), urutan: k.urutan } });
      } else if (del) {
        const k = KATEGORI.filter((x) => x.id === del.dataset.katDel)[0];
        if (!confirm("Hapus kategori " + k.label + "?")) return;
        await api("admin/kategori/" + encodeURIComponent(k.id), { method: "DELETE" });
      } else return;
      toast("Kategori disimpan");
      loadKatalogAdmin();
    } catch (ex) { toast(ex.message); }
  });

  const itemDlg = $("#itemDlg");
  const itemForm = $("#itemForm");
  let editingItem = null;
  function syncTipe() {
    const tipe = itemForm.tipe.value;
    itemForm.querySelectorAll("[data-for]").forEach((el) => { el.hidden = el.dataset.for !== tipe; });
    $("#itemTitle").textContent = (editingItem ? "Ubah " : "") + (tipe === "paket" ? "Paket" : "Produk satuan") + (editingItem ? "" : " baru");
  }
  function openItem(x, tipe) {
    editingItem = x;
    itemForm.reset();
    $("#itemErr").hidden = true;
    $("#itemKat").innerHTML = KATEGORI.map((k) => `<option value="${esc(k.id)}">${esc(k.label)}</option>`).join("") +
      (x && x.kategori && !KATEGORI.some((k) => k.id === x.kategori) ? `<option value="${esc(x.kategori)}">${esc(katLabel(x.kategori))}</option>` : "");
    const v = x || { tipe, satuan: tipe === "paket" ? "paket" : "hari", kelipatan: 1, aktif: true, fitur: [],
      urutan: KATALOG.reduce((m, y) => Math.max(m, y.urutan || 0), 0) + 1, kategori: KATEGORI[0] ? KATEGORI[0].id : "" };
    ["nama", "kategori", "tipe", "harga", "satuan", "kelipatan", "badge", "urutan", "foto", "keterangan_foto"]
      .forEach((k) => { itemForm[k].value = v[k] == null ? "" : v[k]; });
    itemForm.fitur.value = (v.fitur || []).join("\n");
    itemForm.aktif.checked = v.aktif !== false;
    $("#deleteItem").hidden = !x;
    syncTipe();
    itemDlg.showModal();
  }
  itemForm.tipe.addEventListener("change", syncTipe);
  itemDlg.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) itemDlg.close(); });
  document.querySelectorAll("[data-new-item]").forEach((b) => b.addEventListener("click", () => openItem(null, b.dataset.newItem)));
  ["#paketList", "#produkList"].forEach((sel) => $(sel).addEventListener("click", (e) => {
    const b = e.target.closest("[data-item]");
    if (b) openItem(KATALOG.filter((x) => x.id === b.dataset.item)[0]);
  }));

  itemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = itemForm;
    const body = {
      nama: f.nama.value, kategori: f.kategori.value, tipe: f.tipe.value, harga: Number(f.harga.value) || 0,
      satuan: f.satuan.value, kelipatan: f.tipe.value === "produk" ? Number(f.kelipatan.value) || 1 : 1,
      badge: f.tipe.value === "paket" ? f.badge.value : "", urutan: Number(f.urutan.value) || 0,
      fitur: f.tipe.value === "paket" ? f.fitur.value.split("\n").map((t) => t.trim()).filter(Boolean) : [],
      foto: f.foto.value, keterangan_foto: f.keterangan_foto.value, aktif: f.aktif.checked
    };
    if (!body.nama.trim() || f.harga.value === "") {
      $("#itemErr").textContent = "Nama dan harga wajib diisi.";
      $("#itemErr").hidden = false;
      return;
    }
    $("#saveItem").disabled = true;
    try {
      await api("admin/katalog" + (editingItem ? "/" + encodeURIComponent(editingItem.id) : ""), { method: editingItem ? "PUT" : "POST", body });
      itemDlg.close();
      toast(body.nama + " disimpan. Website langsung memakai data baru.");
      loadKatalogAdmin();
    } catch (ex) {
      $("#itemErr").textContent = ex.message;
      $("#itemErr").hidden = false;
    } finally {
      $("#saveItem").disabled = false;
    }
  });
  $("#deleteItem").addEventListener("click", async () => {
    if (!editingItem || !confirm("Hapus " + editingItem.nama + " dari katalog?\n\nPesanan lama tidak berubah. Kalau hanya ingin menyembunyikan sementara, hilangkan centang \"Tampilkan di website\".")) return;
    try {
      await api("admin/katalog/" + encodeURIComponent(editingItem.id), { method: "DELETE" });
      itemDlg.close();
      toast("Dihapus dari katalog");
      loadKatalogAdmin();
    } catch (ex) { toast(ex.message); }
  });

  /* ---------- Ganti password ---------- */
  const pwDlg = $("#pwDlg");
  $("#pwBtn").addEventListener("click", () => { $("#pwForm").reset(); $("#pwErr").hidden = true; pwDlg.showModal(); });
  pwDlg.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) pwDlg.close(); });
  $("#pwForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await api("auth/password", { method: "PUT", body: { lama: f.lama.value, baru: f.baru.value } });
      pwDlg.close();
      toast("Password diganti");
    } catch (ex) {
      $("#pwErr").textContent = ex.message;
      $("#pwErr").hidden = false;
    }
  });

  /* ---------- Mulai ---------- */
  document.querySelectorAll("[data-config]").forEach((el) => {
    const v = C[el.dataset.config];
    if (v !== undefined) el.textContent = v;
  });
  if (!token) {
    showLogin();
  } else {
    api("auth/me").then(showApp).catch(() => showLogin());
  }
})();
