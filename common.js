/* ==========================================================================
   Shared utilities across all pages: nav shell, IndexedDB store, helpers.
   No backend — everything persists in the browser (IndexedDB) so the site
   can be hosted as static files (e.g. GitHub Pages).
   ========================================================================== */

const NAV_ITEMS = [
  { group: "TỔNG QUAN", items: [
    { href: "index.html", label: "Trang chủ (Home)", key: "home" },
  ]},
  { group: "DỮ LIỆU TÀI SẢN", items: [
    { href: "data.html", label: "Data chung (Data & FA-Report)", key: "data" },
    { href: "data.html?new=1", label: "Nhập liệu tài sản mới", key: "form-input" },
    { href: "record.html", label: "Lịch sử cấp phát (Record)", key: "record" },
    { href: "search.html", label: "Tra cứu theo Site Manager", key: "search" },
  ]},
  { group: "SỰ CỐ / THẤT LẠC", items: [
    { href: "broken.html", label: "Broken — Thiết bị hỏng", key: "broken" },
    { href: "lost.html", label: "Lost — Thất lạc", key: "lost" },
  ]},
  { group: "TÀI LIỆU ISO", items: [
    { href: "iso.html", label: "Biểu mẫu & PDF (ISO)", key: "iso" },
  ]},
];

function renderShell(activeKey, pageTitle, pageSub) {
  const shellRoot = document.getElementById("app-shell");
  const nav = NAV_ITEMS.map(g => `
    <div class="nav-group-label">${g.group}</div>
    <ul class="nav-list">
      ${g.items.map(it => `<li><a href="${it.href}" class="${it.key === activeKey ? 'active' : ''}">${it.label}</a></li>`).join("")}
    </ul>
  `).join("");

  shellRoot.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <span class="rivet"></span>
        <div>
          <h1>TAIKISHA VIETNAM<br>FA MANAGER</h1>
          <span>General Administration Dept.</span>
        </div>
      </div>
      ${nav}
    </aside>
    <div class="main">
      <div class="topbar">
        <div>
          <h2>${pageTitle}</h2>
          ${pageSub ? `<div class="sub">${pageSub}</div>` : ""}
        </div>
        <div id="topbar-actions"></div>
      </div>
      <div class="content" id="page-content"></div>
    </div>
  `;
}

/* ---------------- Toasts ---------------- */
function toast(msg, isErr) {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const el = document.createElement("div");
  el.className = "toast" + (isErr ? " err" : "");
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

/* ---------------- Formatting ---------------- */
function fmtMoney(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("vi-VN") + " ₫";
}
function fmtDate(v) {
  if (!v) return "—";
  return v; // already ISO yyyy-mm-dd, keep stable/sortable + readable
}
function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function statusBadge(status) {
  const s = (status || "").trim().toLowerCase();
  if (s === "use") return `<span class="badge badge-use">Use</span>`;
  if (s === "broken") return `<span class="badge badge-broken">Broken</span>`;
  if (s === "spare") return `<span class="badge badge-spare">Spare</span>`;
  return `<span class="badge badge-spare">${esc(status || "—")}</span>`;
}
function uid() {
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/* ---------------- IndexedDB layer ----------------
   DB: fa_manager_db
   Stores:
     attachments  { id, assetCode, assetName, formType, fileName, mimeType, dataUrl, note, uploadedAt }
     brokenLog    { id, reportDate, reportNumber, name, code, serial, location, user, siteManager, reason, pdfId, createdAt }
     lostLog      { id, group, name, code, qty, lossDate, lastUser, note, pdfId, createdAt }
     assetsExtra  { id (=code), ...override/new asset fields }
------------------------------------------------------ */
const DB_NAME = "fa_manager_db";
const DB_VERSION = 1;
let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("attachments")) {
        db.createObjectStore("attachments", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("brokenLog")) {
        db.createObjectStore("brokenLog", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("lostLog")) {
        db.createObjectStore("lostLog", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("assetsExtra")) {
        db.createObjectStore("assetsExtra", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

async function idbAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(store, obj) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(obj);
    tx.oncomplete = () => resolve(obj);
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDelete(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGetByIndexValue(store, field, value) {
  const all = await idbAll(store);
  return all.filter(x => x[field] === value);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function downloadDataUrl(dataUrl, fileName) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName || "file.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function csvExport(rows, headers, fileName) {
  const lines = [headers.map(h => h.label).join(",")];
  rows.forEach(r => {
    lines.push(headers.map(h => {
      let v = r[h.key];
      if (v === null || v === undefined) v = "";
      v = String(v).replace(/"/g, '""');
      return `"${v}"`;
    }).join(","));
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, fileName);
  URL.revokeObjectURL(url);
}
