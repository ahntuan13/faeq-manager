/* Broken tab — mirrors sheet "Broken". Lets staff log newly broken equipment
   and attach the broken/damage report as a PDF, which is recorded (persisted
   in the browser's IndexedDB) and listed below. */

renderShell("broken", "Broken — Thiết bị hỏng", "Ghi nhận thiết bị hỏng và biên bản đính kèm");

let brokenRows = [];

async function boot() {
  document.getElementById("topbar-actions").innerHTML = `
    <button class="btn btn-primary" id="btn-new-broken">+ Ghi nhận thiết bị hỏng</button>
  `;
  document.getElementById("btn-new-broken").onclick = () => openBrokenForm();

  await loadRows();
  renderTable();

  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  if (code) {
    const a = MASTER_DATA.find(x => x.code === code);
    if (a) openBrokenForm(a);
  }
}

async function loadRows() {
  const log = await idbAll("brokenLog");
  const seed = BROKEN_SEED.map((r, i) => ({ ...r, id: "seed_" + i, seeded: true, createdAt: null }));
  brokenRows = [...log.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")), ...seed];
}

function renderTable() {
  const el = document.getElementById("page-content");
  el.innerHTML = `
    <div class="note-banner">📎 Khi ghi nhận thiết bị hỏng, bạn có thể đính kèm file PDF biên bản/báo cáo hỏng — file được lưu ngay trong trình duyệt này.</div>
    <div class="panel">
      <div class="toolbar">
        <div class="field grow">
          <label>Tìm kiếm</label>
          <input type="search" id="f-q" placeholder="Tên, mã tài sản, vị trí, người dùng...">
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Ngày báo hỏng</th><th>Số báo cáo</th><th>Tên / Mã tài sản</th><th>Vị trí</th>
            <th>Người dùng</th><th>Site Manager</th><th>Lý do</th><th>PDF</th><th>Nguồn</th>
          </tr></thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById("f-q").addEventListener("input", (e) => filterAndRender(e.target.value));
  filterAndRender("");
}

async function filterAndRender(q) {
  q = q.trim().toLowerCase();
  const rows = !q ? brokenRows : brokenRows.filter(r => {
    const hay = [r.name, r.code, r.location, r.user, r.siteManager, r.reason, r.reportNumber].join(" ").toLowerCase();
    return hay.includes(q);
  });

  const tbody = document.getElementById("tbody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><h3>Chưa có bản ghi</h3>Nhấn "+ Ghi nhận thiết bị hỏng" để thêm mới.</div></td></tr>`;
    return;
  }

  const withAttach = await Promise.all(rows.map(async r => {
    if (r.seeded) return { r, hasPdf: false };
    const atts = r.pdfId ? await idbAll("attachments").then(all => all.filter(a => a.id === r.pdfId)) : [];
    return { r, hasPdf: atts.length > 0, pdf: atts[0] };
  }));

  tbody.innerHTML = withAttach.map(({ r, hasPdf, pdf }) => `
    <tr>
      <td>${fmtDate(r.reportDate) || "—"}</td>
      <td class="mono">${esc(r.reportNumber) || "—"}</td>
      <td>${esc(r.name)}${r.code ? `<div class="mono" style="color:var(--steel-500);font-size:11px">${esc(r.code)}</div>` : ""}</td>
      <td>${esc(r.location) || "—"}</td>
      <td>${esc(r.user) || "—"}</td>
      <td>${esc(r.siteManager) || "—"}</td>
      <td>${esc(r.reason) || "—"}</td>
      <td>${hasPdf ? `<button class="btn btn-sm btn-ghost" data-view="${pdf.id}">Xem PDF</button>` : "—"}</td>
      <td>${r.seeded ? '<span class="badge badge-spare">File gốc</span>' : '<span class="badge badge-use">Mới ghi nhận</span>'}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("button[data-view]").forEach(b => b.onclick = async () => {
    const atts = await idbAll("attachments");
    const it = atts.find(a => a.id === b.dataset.view);
    if (it) window.open(it.dataUrl, "_blank");
  });
}

function openBrokenForm(prefillAsset) {
  const backdrop = document.getElementById("broken-backdrop");
  const modal = document.getElementById("broken-modal");
  const options = MASTER_DATA.map(a => `<option value="${esc(a.code)}" ${prefillAsset && prefillAsset.code === a.code ? "selected" : ""}>${esc(a.name)} — ${esc(a.code)}</option>`).join("");

  modal.innerHTML = `
    <div class="modal-head"><h3>Ghi nhận thiết bị hỏng</h3><button class="close" id="close-broken">✕</button></div>
    <div class="modal-body">
      <form id="broken-form">
        <div class="form-grid">
          <div class="field full">
            <label>Chọn tài sản từ Data chung (tùy chọn)</label>
            <select id="asset-picker"><option value="">— Chọn để tự điền thông tin —</option>${options}</select>
          </div>
          <div class="field"><label>Ngày báo hỏng</label><input type="date" name="reportDate" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="field"><label>Số báo cáo</label><input type="text" name="reportNumber" placeholder="VD: BR-2026-001"></div>
          <div class="field full"><label>Tên tài sản *</label><input type="text" name="name" required value="${prefillAsset ? esc(prefillAsset.name) : ""}"></div>
          <div class="field"><label>Mã tài sản</label><input type="text" name="code" value="${prefillAsset ? esc(prefillAsset.code) : ""}"></div>
          <div class="field"><label>Serial</label><input type="text" name="serial" value="${prefillAsset ? esc(prefillAsset.serial || "") : ""}"></div>
          <div class="field"><label>Vị trí</label><input type="text" name="location" value="${prefillAsset ? esc(prefillAsset.location || "") : ""}"></div>
          <div class="field"><label>Người dùng</label><input type="text" name="user" value="${prefillAsset ? esc(prefillAsset.user || "") : ""}"></div>
          <div class="field"><label>Site Manager</label><input type="text" name="siteManager" value="${prefillAsset ? esc(prefillAsset.siteManager || "") : ""}"></div>
          <div class="field full"><label>Lý do / mô tả hỏng</label><textarea name="reason" rows="3" placeholder="Mô tả tình trạng hỏng..."></textarea></div>
          <div class="field full">
            <label>File biên bản (PDF)</label>
            <input type="file" name="pdf" accept="application/pdf">
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn" id="cancel-broken">Hủy</button>
          <button type="submit" class="btn btn-primary">Ghi nhận</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById("close-broken").onclick = () => backdrop.classList.remove("open");
  document.getElementById("cancel-broken").onclick = () => backdrop.classList.remove("open");
  document.getElementById("asset-picker").onchange = (e) => {
    const a = MASTER_DATA.find(x => x.code === e.target.value);
    if (!a) return;
    const f = document.getElementById("broken-form");
    f.name.value = a.name || ""; f.code.value = a.code || ""; f.serial.value = a.serial || "";
    f.location.value = a.location || ""; f.user.value = a.user || ""; f.siteManager.value = a.siteManager || "";
  };
  document.getElementById("broken-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    let pdfId = null;
    const file = fd.get("pdf");
    if (file && file.size > 0) {
      if (file.type !== "application/pdf") { toast("Chỉ chấp nhận file PDF.", true); return; }
      const dataUrl = await fileToDataUrl(file);
      pdfId = uid();
      await idbPut("attachments", {
        id: pdfId, assetCode: fd.get("code") || "", assetName: fd.get("name"),
        formType: "Biên bản thiết bị hỏng", fileName: file.name, mimeType: file.type,
        dataUrl, uploadedAt: new Date().toISOString(),
      });
    }
    const rec = {
      id: uid(), reportDate: fd.get("reportDate"), reportNumber: fd.get("reportNumber"),
      name: fd.get("name"), code: fd.get("code"), serial: fd.get("serial"),
      location: fd.get("location"), user: fd.get("user"), siteManager: fd.get("siteManager"),
      reason: fd.get("reason"), pdfId, createdAt: new Date().toISOString(),
    };
    await idbPut("brokenLog", rec);
    toast("Đã ghi nhận thiết bị hỏng" + (pdfId ? " kèm file PDF" : ""));
    backdrop.classList.remove("open");
    await loadRows();
    filterAndRender(document.getElementById("f-q") ? document.getElementById("f-q").value : "");
  };
  backdrop.classList.add("open");
}

document.getElementById("broken-backdrop").addEventListener("click", (e) => {
  if (e.target.id === "broken-backdrop") e.currentTarget.classList.remove("open");
});

boot();
