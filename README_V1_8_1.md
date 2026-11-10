# SMART TKB NAM NHA TRANG — Mobile UI v1.8.1

## Phạm vi phiên bản

**Web 1.8.1 / Vercel API 1.8.0 / Apps Script 1.8.0.** Đây là bản nâng cấp giao diện và trình bày dữ liệu; không sửa cấu trúc Google Sheets, API ghi/xóa lịch hoặc thuật toán PPCT. Có thể dùng chung Google Apps Script đã triển khai ở v1.8.0.

## Những thay đổi chính

1. **Menu trượt bên trái trên điện thoại:** thanh trên cùng chỉ có `☰`, nút tuần trước, tên tuần, nút tuần sau. Bộ lọc, chọn Toàn tuần/Theo ngày, chọn Chính khóa/Dạy thêm/Tổng hợp, trạng thái kết nối, thông báo đồng bộ và đường dẫn tới Nhập Excel/Cài đặt đều vào menu. Chạm mục hoặc chọn bộ lọc sẽ đóng menu. Có thể vuốt từ mép trái màn hình sang phải để mở, vuốt trái hoặc chạm vùng mờ để đóng.
2. **Ưu tiên thời khóa biểu:** điện thoại mở ở chế độ Theo ngày để lớp/môn không bị co nhỏ; thanh chọn đủ bảy ngày từ Thứ Hai đến Chủ nhật luôn dễ chạm. Vẫn có tùy chọn `Toàn tuần` trong menu (bảng 7 cột cuộn ngang để không cắt tên nhóm dài).
3. **Ca dạy thêm gộp để hiển thị:** hai ô *liền kề* cùng ngày, buổi, nhóm/lớp, môn, bài, trạng thái và giờ học được gom thành **một thẻ hiển thị**. Ca khác nhau không bị gộp. Tên `9A_NC`, `9B_CB`, `8A_NC` hoặc tên nhóm tùy chỉnh xuống dòng đầy đủ; không hiện mã `S1·B1`, `S2·B1` trên thẻ. Việc gộp chỉ dành cho giao diện, tuyệt đối **không sửa hoặc xóa các bản ghi gốc** `extra_sessions`/`extra_patterns` trong Google Sheets.
4. **Thống kê điện thoại:** bốn chỉ số đầu trang xếp trên một hàng; cảnh báo dài được ẩn trên di động; thêm bảng chuyên biệt 5 cột `Lớp / Môn`, `Kế hoạch`, `Đã dạy`, `Nhanh / Chậm`, `Tiết tiếp theo`, ô dữ liệu tự xuống dòng không tràn mép phải. Các bản ghi PPCT vẫn giữ nguyên; nhãn `Tạm tính` vẫn còn khi chưa đủ xác nhận.
5. **Không bỏ thông báo lỗi ghi:** trạng thái lưu hoặc lỗi quan trọng chuyển thành toast ở cuối màn hình, tránh chiếm vùng tiêu đề nhưng vẫn đọc được.

## Cập nhật GitHub/Vercel

1. Sao lưu repository và Google Sheets trước khi cập nhật.
2. Giải nén ZIP, sao chép các file/thư mục tại **gốc dự án** lên repository GitHub đang kết nối với Vercel (`src/`, `api/`, `public/`, `index.html`, `package.json`, `vercel.json`, `scripts/build.mjs`...).
3. Vercel tự build; kiểm tra `https://<ten-mien-cua-thay>/release.json` có `frontend: 1.8.1` và `api/tkb?action=version` báo `apiVersion: 1.8.0` (endpoint API có thể yêu cầu kết nối/phiên tùy thao tác).
4. **Không cần triển khai lại Apps Script, không đổi GAS_URL** nếu Vercel API và GAS của thầy đã ở bản 1.8.0. Giữ nguyên các biến môi trường.
5. Tải lại trang trên điện thoại (có thể đóng/mở lại tab), mở `☰` để chuyển chế độ xem hoặc vào trang Thống kê.

## Kiểm thử và giới hạn

- `npm test`: 104/104 bài kiểm thử đạt (gồm 5 bài kiểm thử mới cho gộp ca Dạy thêm và bố cục mobile).
- `npm run build`: đã hoàn thành.
- Kiểm tra ứng dụng bằng Chromium với backend mô phỏng: 320, 390, 430 px; tiêu đề, menu vuốt, bộ lọc, bảng 5 cột, tên nhóm dài, cuộn dọc đến cuối ngày đều đạt; không phát hiện lỗi JavaScript hoặc tràn ngang trong các trạng thái thử.
- **Chưa triển khai lên Vercel hoặc kết nối thử Google Sheets thật.** Cần kiểm tra lại trên địa chỉ web Production sau khi cập nhật.

## Dữ liệu cần bảo toàn

Vì đây là bản nâng cấp UI, không cần nhập lại các file Excel, xóa cache toàn hệ thống hay tạo phiên bản TKB mới. Dữ liệu chính khóa, PPCT, tăng vượt và dạy thêm vẫn lưu theo backend hiện tại. Nếu hai ô dạy thêm thực sự là *hai buổi riêng*, chương trình vẫn giữ hai ô; chỉ các ô được xác định là cùng một ca mới gộp giao diện.
