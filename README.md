# Smart TKB 1.8.4 — Mốc PPCT không hồi tố

Nâng cấp trực tiếp từ Smart TKB 1.8.3. Giữ nguyên lịch 7 ngày, dạy thêm, quy tắc Toán ĐS/HH, toàn bộ dữ liệu và chức năng đang có.

## Thay đổi

- Mỗi mốc PPCT gắn với **tuần bắt đầu áp dụng** trong bảng riêng `baseline_revisions`.
- Tuần trước mốc mới giữ nguyên, kể cả kết quả thống kê tiến độ tại tuần đó.
- Phần **Nội dung bài từ PPCT & tiến độ** chỉ xem; chọn bài không tự ghi dữ liệu.
- Máy chủ thực hiện ghi có xác minh dữ liệu và bảo vệ tiết đã xác nhận.
- Bảng `baselines` và danh mục PPCT gốc không bị xóa hoặc ghi đè bởi chức năng này.

Xem `HUONG_DAN_CAP_NHAT_1_8_4.md` để triển khai cả Web + API + Google Apps Script.
