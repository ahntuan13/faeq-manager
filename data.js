/* Data chung — merges "Data" + "FA-Report" sheets into a single explorable table */

const MONTH_LABELS_2026 = ["T1/26","T2/26","T3/26","T4/26","T5/26","T6/26","T7/26","T8/26","T9/26","T10/26","T11/26","T12/26"];

let allAssets = [];          // MASTER_DATA + extras from IndexedDB
let filteredAssets = [];
let sortKey = "no";
let sortDir = 1;
let currentPage = 1;
const PAGE_SIZE = 25;

renderShell("data", "Data chung", "Gộp sheet Data &amp; FA-Report — thông tin tài sản và khấu hao 2026 trong 1 bảng");

async function boot() {
  document.getElementById("topbar-actions").innerHTML = `
    <button class="btn btn-ghost" id="btn-export">⭳ Xuất CSV</button>
    <button class="btn btn-primary" id="btn-add">+ Nhập liệu tài sản mới</button>
  `;
  document.getElementById("btn-export").onclick = doExport;
  document.getElementById("btn-add").onclick = () => openFormModal();

  const extras = await idbAll("assetsExtra");
  allAssets = [...MASTER_DATA, ...extras];

  renderContent();
  applyFilters();

  const params = new URLSearchParams(location.search);
  if (params.get("new") === "1") openFormModal();
  const openCode = params.get("code");
  if (openCode) {
    const a = allAssets.find(x => x.code === openCode);
    if (a) openDetail(a);
  }
}

function renderContent() {
  const groups = [...new Set(allAssets.map(a => (a.group || "").trim()).filter(Boolean))].sort();
  const locations = [...new Set(allAssets.map(a => (a.location || "").trim()).filter(Boolean))].sort();

  document.getElementById("page-content").innerHTML = `
    <div class="panel">
      <div class="toolbar">
        <div class="field grow">
          <label>Tìm kiếm</label>
          <input type="search" id="f-q" placeholder="Tên tài sản, mã, serial, người dùng...">
        </div>
        <div class="field">
          <label>Nhóm</label>
          <select id="f-group"><option value="">Tất cả</option>${groups.map(g => `<option>${esc(g)}</option>`).join("")}</select>
        </div>
        <div class="field">
          <label>Trạng thái</label>
          <select id="f-status">
            <option value="">Tất cả</option>
            <option value="use">Use</option>
            <option value="spare">Spare</option>
            <option value="broken">Broken</option>
          </select>
        </div>
        <div class="field">
          <label>Vị trí</label>
          <select id="f-location"><option value="">Tất cả</option>${locations.map(l => `<option>${esc(l)}</option>`).join("")}</select>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th data-k="no">No</th>
            <th data-k="group">Nhóm</th>
            <th data-k="name">Tên tài sản</th>
            <th data-k="code">Mã</th>
            <th data-k="status">Trạng thái</th>
            <th data-k="location">Vị trí</th>
            <th data-k="user">Người dùng</th>
            <th data-k="siteManager">Site Manager</th>
            <th data-k="totalPrice">Nguyên giá</th>
            <th data-k="remaining">Còn lại 2026</th>
          </tr></thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
      <div class="pagination" id="pagination"></div>
    </div>
  `;

  document.querySelectorAll("thead th[data-k]").forEach(th => {
    th.onclick = () => {
      const k = th.dataset.k;
      if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; }
      currentPage = 1;
      applyFilters();
    };
  });

  ["f-q", "f-group", "f-status", "f-location"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => { currentPage = 1; applyFilters(); });
  });
}

function applyFilters() {
  const q = document.getElementById("f-q").value.trim().toLowerCase();
  const g = document.getElementById("f-group").value;
  const st = document.getElementById("f-status").value;
  const loc = document.getElementById("f-location").value;

  filteredAssets = allAssets.filter(a => {
    if (g && (a.group || "").trim() !== g) return false;
    if (st && (a.status || "").trim().toLowerCase() !== st) return false;
    if (loc && (a.location || "").trim() !== loc) return false;
    if (q) {
      const hay = [a.name, a.code, a.serial, a.user, a.siteManager, a.location].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  filteredAssets.sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va === null || va === undefined) va = "";
    if (vb === null || vb === undefined) vb = "";
    if (va < vb) return -1 * sortDir;
    if (va > vb) return 1 * sortDir;
    return 0;
  });

  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("tbody");
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredAssets.slice(start, start + PAGE_SIZE);

  if (!pageRows.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><h3>Không tìm thấy tài sản</h3>Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.</div></td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map(a => `
      <tr data-code="${esc(a.code)}">
        <td>${esc(a.no ?? "")}</td>
        <td>${esc(a.group)}</td>
        <td>${esc(a.name)}</td>
        <td class="mono">${esc(a.code)}</td>
        <td>${statusBadge(a.status)}</td>
        <td>${esc(a.location)}</td>
        <td>${esc(a.user)}</td>
        <td>${esc(a.siteManager)}</td>
        <td class="num-cell">${fmtMoney(a.totalPrice)}</td>
        <td class="num-cell">${fmtMoney(a.remaining)}</td>
      </tr>
    `).join("");
    tbody.querySelectorAll("tr[data-code]").forEach(tr => {
      tr.onclick = () => {
        const a = allAssets.find(x => x.code === tr.dataset.code);
        if (a) openDetail(a);
      };
    });
  }

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  document.getElementById("pagination").innerHTML = `
    <span>${filteredAssets.length.toLocaleString("vi-VN")} tài sản — trang ${currentPage}/${totalPages}</span>
    <span style="flex:1"></span>
    <button class="btn btn-sm btn-ghost" id="pg-prev" ${currentPage <= 1 ? "disabled" : ""}>← Trước</button>
    <button class="btn btn-sm btn-ghost" id="pg-next" ${currentPage >= totalPages ? "disabled" : ""}>Sau →</button>
  `;
  document.getElementById("pg-prev").onclick = () => { currentPage--; renderTable(); };
  document.getElementById("pg-next").onclick = () => { currentPage++; renderTable(); };
}

function doExport() {
  csvExport(filteredAssets, [
    { key: "no", label: "No" }, { key: "group", label: "Nhom" }, { key: "name", label: "Ten tai san" },
    { key: "code", label: "Ma" }, { key: "serial", label: "Serial" }, { key: "status", label: "Trang thai" },
    { key: "location", label: "Vi tri" }, { key: "user", label: "Nguoi dung" }, { key: "siteManager", label: "Site Manager" },
    { key: "totalPrice", label: "Nguyen gia" }, { key: "remaining", label: "Con lai 2026" },
  ], "data_chung.csv");
}

/* ---------------- Detail modal ---------------- */
async function openDetail(a) {
  const backdrop = document.getElementById("detail-backdrop");
  const modal = document.getElementById("detail-modal");

  const monthsRows = a.fa2026 ? a.fa2026.months.map((m, i) => `
    <tr><td>${MONTH_LABELS_2026[i]}</td><td class="num-cell">${fmtMoney(m.val)}</td><td class="mono">${esc(m.job || "—")}</td></tr>
  `).join("") : "";

  modal.innerHTML = `
    <div class="modal-head">
      <div>
        <h3>${esc(a.name)}</h3>
        <div class="sub" style="color:var(--steel-500);font-size:12.5px;margin-top:4px" class="mono">${esc(a.code)}</div>
      </div>
      <button class="close" id="close-detail">✕</button>
    </div>
    <div class="modal-body">
      <div class="detail-grid">
        <div class="detail-item"><div class="k">Nhóm</div><div class="v">${esc(a.group) || "—"}</div></div>
        <div class="detail-item"><div class="k">Trạng thái</div><div class="v">${statusBadge(a.status)}</div></div>
        <div class="detail-item"><div class="k">Serial</div><div class="v mono">${esc(a.serial) || "—"}</div></div>
        <div class="detail-item"><div class="k">Loại</div><div class="v">${esc(a.type) || "—"}</div></div>
        <div class="detail-item"><div class="k">Vị trí</div><div class="v">${esc(a.location) || "—"}</div></div>
        <div class="detail-item"><div class="k">Người dùng</div><div class="v">${esc(a.user) || "—"}</div></div>
        <div class="detail-item"><div class="k">Site Manager</div><div class="v">${esc(a.siteManager) || "—"}</div></div>
        <div class="detail-item"><div class="k">Số tháng khấu hao</div><div class="v">${esc(a.months) || "—"}</div></div>
        <div class="detail-item"><div class="k">Ngày bắt đầu dùng</div><div class="v">${fmtDate(a.dateUse)}</div></div>
        <div class="detail-item"><div class="k">Ngày kết thúc KH</div><div class="v">${fmtDate(a.dateEnd)}</div></div>
        <div class="detail-item"><div class="k">Nguyên giá</div><div class="v">${fmtMoney(a.totalPrice)}</div></div>
        <div class="detail-item"><div class="k">Hao mòn lũy kế → 2025</div><div class="v">${fmtMoney(a.accDepUpto2025)}</div></div>
        <div class="detail-item"><div class="k">Phân bổ 2026</div><div class="v">${fmtMoney(a.allocationTotal2026)}</div></div>
        <div class="detail-item"><div class="k">Giá trị còn lại</div><div class="v">${fmtMoney(a.remaining)}</div></div>
      </div>

      ${a.fa2026 ? `
      <div class="section-title">Khấu hao theo tháng — 2026 (FA-Report)</div>
      <div class="table-wrap">
        <table><thead><tr><th>Tháng</th><th>Giá trị</th><th>Job</th></tr></thead><tbody>${monthsRows}</tbody></table>
      </div>` : `<div class="note-banner">Tài sản này chưa có chi tiết khấu hao theo tháng trong sheet FA-Report.</div>`}

      <div class="section-title">
        Tài liệu ISO đính kèm (PDF)
        <button class="btn btn-sm btn-primary" id="btn-upload-pdf">+ Tải lên PDF</button>
      </div>
      <div class="attach-list" id="attach-list"><div style="font-size:12.5px;color:var(--steel-500)">Đang tải...</div></div>
      <input type="file" id="pdf-input" accept="application/pdf" style="display:none">

      <div class="section-title">Tạo biểu mẫu ISO</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn btn-sm" href="iso.html?code=${encodeURIComponent(a.code)}&form=GA-AD-A20-2-1">GA-AD-A20-2-1 · Fixed Asset Card</a>
        <a class="btn btn-sm" href="iso.html?code=${encodeURIComponent(a.code)}&form=GA-AD-A20-2-2">GA-AD-A20-2-2 · Equipment Card</a>
        <a class="btn btn-sm" href="iso.html?code=${encodeURIComponent(a.code)}&form=GA-AD-A20-3">GA-AD-A20-3 · Hand-over Memo</a>
        <a class="btn btn-sm btn-danger" href="broken.html?code=${encodeURIComponent(a.code)}">⚠ Báo hỏng tài sản này</a>
      </div>
    </div>
  `;

  document.getElementById("close-detail").onclick = () => backdrop.classList.remove("open");
  backdrop.classList.add("open");

  document.getElementById("btn-upload-pdf").onclick = () => document.getElementById("pdf-input").click();
  document.getElementById("pdf-input").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") { toast("Chỉ chấp nhận file PDF.", true); return; }
    const dataUrl = await fileToDataUrl(file);
    await idbPut("attachments", {
      id: uid(), assetCode: a.code, assetName: a.name, formType: "Tài liệu chung",
      fileName: file.name, mimeType: file.type, dataUrl, uploadedAt: new Date().toISOString(),
    });
    toast("Đã tải lên " + file.name);
    loadAttachments(a.code);
  };

  loadAttachments(a.code);
}

async function loadAttachments(code) {
  const list = document.getElementById("attach-list");
  const items = await idbGetByIndexValue("attachments", "assetCode", code);
  if (!items.length) {
    list.innerHTML = `<div style="font-size:12.5px;color:var(--steel-500)">Chưa có file PDF nào được đính kèm cho tài sản này.</div>`;
    return;
  }
  list.innerHTML = items.map(it => `
    <div class="attach-item">
      <div class="file-ico">PDF</div>
      <div class="meta">
        <div class="name">${esc(it.fileName)}</div>
        <div class="sub">${esc(it.formType)} · ${new Date(it.uploadedAt).toLocaleString("vi-VN")}</div>
      </div>
      <button class="btn btn-sm btn-ghost" data-act="view" data-id="${it.id}">Xem</button>
      <button class="btn btn-sm btn-ghost" data-act="del" data-id="${it.id}">Xóa</button>
    </div>
  `).join("");
  list.querySelectorAll("button[data-act=view]").forEach(b => b.onclick = () => {
    const it = items.find(x => x.id === b.dataset.id);
    window.open(it.dataUrl, "_blank");
  });
  list.querySelectorAll("button[data-act=del]").forEach(b => b.onclick = async () => {
    await idbDelete("attachments", b.dataset.id);
    toast("Đã xóa file đính kèm");
    loadAttachments(code);
  });
}

document.getElementById("detail-backdrop").addEventListener("click", (e) => {
  if (e.target.id === "detail-backdrop") e.currentTarget.classList.remove("open");
});
document.getElementById("form-backdrop").addEventListener("click", (e) => {
  if (e.target.id === "form-backdrop") e.currentTarget.classList.remove("open");
});

/* ---------------- Add-asset form ---------------- */
function openFormModal() {
  const backdrop = document.getElementById("form-backdrop");
  const modal = document.getElementById("form-modal");
  const nextNo = Math.max(0, ...allAssets.map(a => Number(a.no) || 0)) + 1;

  modal.innerHTML = `
    <div class="modal-head">
      <h3>Nhập liệu tài sản mới</h3>
      <button class="close" id="close-form">✕</button>
    </div>
    <div class="modal-body">
      <form id="asset-form">
        <div class="form-grid">
          <div class="field"><label>No</label><input type="text" value="${nextNo}" disabled></div>
          <div class="field"><label>Nhóm (Group) *</label><input type="text" name="group" required placeholder="Laptop, Desktop, Printer..."></div>
          <div class="field full"><label>Tên tài sản (FA Name) *</label><input type="text" name="name" required></div>
          <div class="field"><label>Mã tài sản (New code) *</label><input type="text" name="code" required></div>
          <div class="field"><label>Serial Number</label><input type="text" name="serial"></div>
          <div class="field"><label>Loại (Type)</label>
            <select name="type"><option value="FA">FA</option><option value="EQ">EQ</option><option value="OT">OT</option></select>
          </div>
          <div class="field"><label>Trạng thái</label>
            <select name="status"><option value="Use">Use</option><option value="Spare">Spare</option><option value="Broken">Broken</option></select>
          </div>
          <div class="field"><label>Số lượng</label><input type="number" name="qty" value="1"></div>
          <div class="field"><label>Số tháng khấu hao</label><input type="number" name="months" value="24"></div>
          <div class="field"><label>Ngày bắt đầu dùng</label><input type="date" name="dateUse"></div>
          <div class="field"><label>Ngày kết thúc KH</label><input type="date" name="dateEnd"></div>
          <div class="field"><label>Vị trí (Location)</label><input type="text" name="location"></div>
          <div class="field"><label>Người dùng (User)</label><input type="text" name="user"></div>
          <div class="field"><label>Site Manager</label><input type="text" name="siteManager"></div>
          <div class="field"><label>Nguyên giá (Total price)</label><input type="number" name="totalPrice" value="0"></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn" id="cancel-form">Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu tài sản</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById("close-form").onclick = () => backdrop.classList.remove("open");
  document.getElementById("cancel-form").onclick = () => backdrop.classList.remove("open");
  document.getElementById("asset-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const code = fd.get("code").trim();
    if (allAssets.some(a => a.code === code)) { toast("Mã tài sản đã tồn tại.", true); return; }
    const rec = {
      id: code, no: nextNo, group: fd.get("group"), name: fd.get("name"), code,
      serial: fd.get("serial"), type: fd.get("type"), status: fd.get("status"),
      qty: Number(fd.get("qty")) || 1, months: Number(fd.get("months")) || null,
      dateUse: fd.get("dateUse") || null, dateEnd: fd.get("dateEnd") || null,
      location: fd.get("location"), user: fd.get("user"), siteManager: fd.get("siteManager"),
      totalPrice: Number(fd.get("totalPrice")) || 0, remaining: Number(fd.get("totalPrice")) || 0,
      accDepUpto2025: 0, allocationTotal2026: 0,
    };
    await idbPut("assetsExtra", rec);
    allAssets.push(rec);
    toast("Đã lưu tài sản mới: " + rec.name);
    backdrop.classList.remove("open");
    currentPage = 1;
    applyFilters();
  };
  backdrop.classList.add("open");
}

boot();
