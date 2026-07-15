/* Lost tab — mirrors sheet "Lost" (template was empty in the source file). */

renderShell("lost", "Lost — Thất lạc", "Ghi nhận tài sản thất lạc / báo mất");

let lostRows = [];

async function boot() {
  document.getElementById("topbar-actions").innerHTML = `<button class="btn btn-primary" id="btn-new">+ Ghi nhận thất lạc</button>`;
  document.getElementById("btn-new").onclick = () => openLostForm();
  await loadRows();
  renderTable();
}

async function loadRows() {
  const log = await idbAll("lostLog");
  const seed = LOST_DATA.map((r, i) => ({ ...r, id: "seed_" + i, seeded: true }));
  lostRows = [...log.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")), ...seed];
}

function renderTable() {
  const el = document.getElementById("page-content");
  if (!lostRows.length) {
    el.innerHTML = `
      <div class="note-banner">Sheet "Lost" trong file gốc chưa có dữ liệu (chỉ là mẫu trống). Bạn có thể bắt đầu ghi nhận tại đây.</div>
      <div class="panel"><div class="empty-state"><h3>Chưa có tài sản thất lạc nào được ghi nhận</h3>Nhấn "+ Ghi nhận thất lạc" để thêm mới.</div></div>`;
    return;
  }
  el.innerHTML = `
    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ngày mất</th><th>Nhóm</th><th>Tên / Mã</th><th>Người dùng cuối</th><th>Nguyên giá</th><th>PDF</th><th>Nguồn</th></tr></thead>
          <tbody>
            ${lostRows.map(r => `
              <tr>
                <td>${fmtDate(r.lossDate) || "—"}</td>
                <td>${esc(r.group) || "—"}</td>
                <td>${esc(r.name)}${r.code ? `<div class="mono" style="color:var(--steel-500);font-size:11px">${esc(r.code)}</div>` : ""}</td>
                <td>${esc(r.lastUser) || "—"}</td>
                <td class="num-cell">${fmtMoney(r.totalPrice)}</td>
                <td>${r.pdfId ? `<button class="btn btn-sm btn-ghost" data-view="${r.pdfId}">Xem PDF</button>` : "—"}</td>
                <td>${r.seeded ? '<span class="badge badge-spare">File gốc</span>' : '<span class="badge badge-use">Mới ghi nhận</span>'}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
  el.querySelectorAll("button[data-view]").forEach(b => b.onclick = async () => {
    const atts = await idbAll("attachments");
    const it = atts.find(a => a.id === b.dataset.view);
    if (it) window.open(it.dataUrl, "_blank");
  });
}

function openLostForm() {
  const backdrop = document.getElementById("lost-backdrop");
  const modal = document.getElementById("lost-modal");
  modal.innerHTML = `
    <div class="modal-head"><h3>Ghi nhận tài sản thất lạc</h3><button class="close" id="close-lost">✕</button></div>
    <div class="modal-body">
      <form id="lost-form">
        <div class="form-grid">
          <div class="field"><label>Nhóm</label><input type="text" name="group"></div>
          <div class="field full"><label>Tên tài sản *</label><input type="text" name="name" required></div>
          <div class="field"><label>Mã tài sản</label><input type="text" name="code"></div>
          <div class="field"><label>Ngày mất</label><input type="date" name="lossDate" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="field"><label>Người dùng cuối</label><input type="text" name="lastUser"></div>
          <div class="field"><label>Nguyên giá</label><input type="number" name="totalPrice" value="0"></div>
          <div class="field full"><label>Ghi chú</label><textarea name="note" rows="3"></textarea></div>
          <div class="field full"><label>File biên bản (PDF)</label><input type="file" name="pdf" accept="application/pdf"></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn" id="cancel-lost">Hủy</button>
          <button type="submit" class="btn btn-primary">Ghi nhận</button>
        </div>
      </form>
    </div>`;
  document.getElementById("close-lost").onclick = () => backdrop.classList.remove("open");
  document.getElementById("cancel-lost").onclick = () => backdrop.classList.remove("open");
  document.getElementById("lost-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    let pdfId = null;
    const file = fd.get("pdf");
    if (file && file.size > 0) {
      if (file.type !== "application/pdf") { toast("Chỉ chấp nhận file PDF.", true); return; }
      const dataUrl = await fileToDataUrl(file);
      pdfId = uid();
      await idbPut("attachments", { id: pdfId, assetCode: fd.get("code") || "", assetName: fd.get("name"), formType: "Biên bản thất lạc", fileName: file.name, mimeType: file.type, dataUrl, uploadedAt: new Date().toISOString() });
    }
    await idbPut("lostLog", { id: uid(), group: fd.get("group"), name: fd.get("name"), code: fd.get("code"), lossDate: fd.get("lossDate"), lastUser: fd.get("lastUser"), totalPrice: Number(fd.get("totalPrice")) || 0, note: fd.get("note"), pdfId, createdAt: new Date().toISOString() });
    toast("Đã ghi nhận tài sản thất lạc");
    backdrop.classList.remove("open");
    await loadRows();
    renderTable();
  };
  backdrop.classList.add("open");
}

document.getElementById("lost-backdrop").addEventListener("click", (e) => {
  if (e.target.id === "lost-backdrop") e.currentTarget.classList.remove("open");
});

boot();
