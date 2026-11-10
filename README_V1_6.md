# Smart TKB V1.6 — Nam Nha Trang

Giáo viên: **Lê Hoàng Ngọc Đức** · Năm học 2026–2027.

Đây là **bản nâng cấp dựa trên mã V1.5**, không phải dự án viết lại. Chức năng chính khóa, PPCT ĐS/HH, Tin học, điều chỉnh tiết và thống kê được bảo toàn.

## Chức năng mới

- Lưu dạy thêm bền vững qua API có kiểm tra ghi và đọc lại, mã thao tác chống trùng.
- Một suất có nhiều lớp/nhóm tự đặt tên; có thể bổ sung hoặc bớt từng nhóm.
- Lặp hàng tuần, chỉ một tuần, lặp đến ngày, chỉnh sửa một lần/toàn bộ/từ ngày hiện tại, nghỉ một tuần, dừng chuỗi.
- Chế độ **Toàn tuần** và **Theo ngày**; menu bộ lọc ẩn bên trái trên điện thoại.
- Màu lớp nhất quán, ô hiển thị tiết PPCT hoặc buổi dạy thêm, thao tác bằng Bottom Sheet trên điện thoại.

## Chạy thử tại máy

Cần Node.js 20 trở lên. Trong thư mục dự án:

```bash
npm install
npm run dev
```

Mở địa chỉ do Vite thông báo (thường `http://localhost:5173`). Chạy thử logic:

```bash
npm test
```

Khi chưa có API Vercel, màn hình ở **chế độ dùng thử**, dữ liệu chỉ nằm trong trình duyệt đó. Đây không phải lưu Google Sheets.

## Triển khai

Đọc **`HUONG_DAN_NANG_CAP_V1_6.md`** trước khi cập nhật Apps Script và GitHub.

Biến môi trường Vercel hiện có: `APP_PASSWORD`, `SESSION_SECRET`, `GAS_URL`, `GAS_API_KEY`. Script Properties của Apps Script: `SMART_TKB_API_KEY`. Không công khai giá trị các khóa.

## Giới hạn và an toàn

- Thay đổi schema theo cách thêm cột và tạo tab, không xóa các sheet cũ.
- Apps Script dùng `LockService` và `requestId`, giúp chống lưu trùng khi gửi lại. Google Sheets không cung cấp giao dịch ACID như cơ sở dữ liệu quan hệ; các thao tác nhiều dòng có xử lý khôi phục tốt nhất có thể nhưng vẫn cần sao lưu trước nâng cấp.
- Kết nối Production cần xác minh trên tài khoản thật sau khi triển khai.
