# TAIKISHA FA Manager

Web quản lý tài sản cố định (Fixed Asset), được build từ file `FA_master_list_-Jun_2026-F.xlsm`.
Đây là ứng dụng **tĩnh** (static site) — không cần server/backend, chạy được trực tiếp bằng
cách mở `index.html`, hoặc host miễn phí trên **GitHub Pages**.

## Cấu trúc

```
fa-app/
├── index.html          Trang chủ (tương đương sheet INDEX)
├── data.html            Data chung = sheet Data + FA-Report gộp lại
├── broken.html           Ghi nhận & xem thiết bị hỏng (upload PDF)
├── lost.html             Ghi nhận & xem tài sản thất lạc (upload PDF)
├── record.html           Lịch sử cấp phát (sheet Record)
├── search.html           Tra cứu theo Site Manager (sheet Search + Secretary_Record)
├── iso.html              Trung tâm biểu mẫu ISO + thư viện PDF đã tải lên
├── assets/
│   ├── css/style.css
│   ├── js/               common.js, data.js, broken.js, lost.js
│   └── data/              master.js, broken.js, record.js, lost.js — dữ liệu gốc
│                           từ file Excel, nhúng sẵn dạng JS (không cần server để đọc)
└── README.md
```

## Dữ liệu & lưu trữ

- Dữ liệu gốc (Data, FA-Report, Broken, Record...) được trích xuất 1 lần từ file Excel và
  nhúng thẳng vào `assets/data/*.js` — mở trang là thấy ngay, không cần upload lại file Excel.
- Các thao tác **mới** (nhập tài sản mới, ghi nhận thiết bị hỏng/thất lạc, tải PDF lên) được
  lưu trong **IndexedDB của trình duyệt** (không có backend). Nghĩa là:
  - Dữ liệu mới **chỉ lưu trên máy/trình duyệt** đang thao tác, không tự động đồng bộ cho người khác.
  - Xóa dữ liệu trình duyệt (clear browsing data) sẽ mất các bản ghi mới này.
  - Nếu cần nhiều người cùng nhập liệu và đồng bộ dữ liệu thật, cần bổ sung một backend
    (ví dụ: Google Sheets API, Firebase, hoặc một API nội bộ) — phần này ứng dụng hiện chưa có.

## Cách xem thử ngay (không cần deploy)

Mở trực tiếp `index.html` bằng trình duyệt (Chrome/Edge). Toàn bộ tính năng xem dữ liệu
hoạt động bình thường qua giao thức `file://`.

## Deploy lên GitHub Pages

1. Tạo 1 repository mới trên GitHub, ví dụ `fa-manager`.
2. Copy toàn bộ nội dung thư mục `fa-app/` (không copy chính thư mục `fa-app`, mà là các
   file/thư mục *bên trong* nó) vào repo, rồi commit & push:
   ```bash
   git init
   git add .
   git commit -m "FA Manager web app"
   git branch -M main
   git remote add origin https://github.com/<username>/fa-manager.git
   git push -u origin main
   ```
3. Vào repo trên GitHub → **Settings → Pages**.
4. Ở mục **Build and deployment**, chọn **Source: Deploy from a branch**, **Branch: main**,
   thư mục `/ (root)`, rồi bấm **Save**.
5. Sau 1–2 phút, GitHub sẽ cấp một địa chỉ dạng:
   `https://<username>.github.io/fa-manager/`
   Mở link đó là xem được ứng dụng.

> Lưu ý: vì đây là repo công khai theo mặc định của GitHub Pages (trừ khi bạn có GitHub Pro/Enterprise
> để bật Pages cho repo private), dữ liệu tài sản nhúng trong `assets/data/*.js` sẽ **công khai**
> với bất kỳ ai có link. Nếu dữ liệu nhạy cảm, nên dùng repo private + GitHub Enterprise, hoặc
> host nội bộ (intranet) thay vì GitHub Pages công khai.

## Cập nhật dữ liệu gốc từ Excel sau này

Khi có file Excel mới hơn, cần export lại 3 sheet chính (Data, FA-Report, Broken, Record) thành
JSON rồi build lại các file trong `assets/data/`. Nhắn lại để được hỗ trợ tạo bản cập nhật.
