# HƯỚNG DẪN NÂNG CẤP SMART TKB 1.8.1 — GIAO DIỆN ĐIỆN THOẠI

**Phiên bản:** Web 1.8.1 · API 1.8.0 · Google Apps Script 1.8.0

## Bước 1. Sao lưu

- Sao lưu repository GitHub và sao lưu tệp Google Sheets hiện có trước khi cập nhật.
- Không xóa dữ liệu PPCT, lịch sử xác nhận đã dạy, dữ liệu `extra_sessions`, `extra_patterns` hoặc các phiên bản TKB.

## Bước 2. Cập nhật giao diện trên GitHub/Vercel

1. Giải nén `Smart_TKB_V1_8_1_Toi_Uu_Mobile.zip`.
2. Thay các file trong repository bằng các file tương ứng từ ZIP (đặc biệt `src/main.js`, `src/style.css`, `src/mobileDisplay.js`, `index.html` và `public/release.json`). Cách đơn giản nhất là đẩy toàn bộ nội dung ZIP lên thư mục gốc của repository, không lồng thêm một thư mục cấp ngoài.
3. Bảo đảm vẫn có các thư mục `api`, `src`, `public` và file `vercel.json` tại gốc dự án.
4. Đẩy commit để Vercel tự triển khai. `npm run build` tạo thư mục `dist/`.
5. Kiểm tra `https://thoikhoabieu-sage.vercel.app/release.json` hiển thị `frontend: "1.8.1"`.

**Không cần thay Code.gs hay đổi GAS_URL** khi Apps Script 1.8.0 đã chạy tốt: đây là bản chỉnh sửa giao diện, không đổi giao thức lưu trữ.

## Bước 3. Sử dụng trên điện thoại

- Mở web ở màn hình dọc. Tiêu đề gọn: `☰` → tuần trước → tên tuần → tuần sau.
- Bấm `☰` hoặc vuốt từ sát mép trái sang phải để mở menu. Chọn Chính khóa, Dạy thêm, Tổng hợp, Thống kê, Nhập Excel, Cấu hình; sau khi chọn menu tự đóng.
- Ở **Lịch tuần**, mặc định trên điện thoại là **Theo ngày**; bấm tên thứ hoặc các nút mũi tên để xem Thứ Hai đến Chủ nhật. Muốn xem 7 cột một lúc, mở `☰ → Hiển thị → Toàn tuần` rồi vuốt ngang bảng.
- Ca Dạy thêm trùng hai tiết liền nhau nhưng thực chất cùng nhóm và cùng bài chỉ hiện một thẻ; mở Danh sách Dạy thêm để quản lý bản ghi riêng nếu cần.
- Ở **Thống kê**, bốn số tổng quan ở một hàng; bảng PPCT có 5 cột vừa chiều ngang điện thoại, tên bài dài sẽ xuống dòng.

## Bước 4. Kiểm tra sau cập nhật

1. Mở ở điện thoại, thử vuốt mở menu, chọn trang, chuyển tuần; menu tự đóng.
2. Xem một ca `9A_NC`/`9B_CB`; tên nhóm hiển thị trọn và không có mã `S1·B1`, `S2·B1`.
3. Mở **Thống kê**, đối chiếu đủ 5 cột không tràn ngang.
4. Kiểm tra một tiết chính khóa và một ca dạy thêm đã có trên Google Sheets trước/sau cập nhật để xác nhận dữ liệu được giữ nguyên.

## Lưu ý

Bản v1.8.1 được kiểm thử frontend trong môi trường trình duyệt mô phỏng. Chưa kiểm thử trực tiếp với tài khoản Google Sheets và địa chỉ Production của thầy. Khi gặp lỗi lưu, không xóa dữ liệu: mở menu và thực hiện kiểm tra kết nối trước.
