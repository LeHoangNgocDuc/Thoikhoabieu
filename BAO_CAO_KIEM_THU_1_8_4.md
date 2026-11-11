# Kết quả kiểm thử Smart TKB 1.8.4

- **121/121** bài kiểm thử tự động Node đạt (`npm test`).
- `npm run build`: thành công; thư mục `dist/` sẵn sàng cho Vercel.
- Kiểm tra cú pháp `src/main.js`, `src/core.js`, `src/cache.js`, `api/tkb.js` và `gas/Code.gs`: đạt.
- Kiểm thử bổ sung phiên bản 1.8.4:
  - Đổi Toán 9/1 Đại số từ tuần 11 không thay lịch và tiến độ của tuần 10.
  - Thêm mốc khác ở tuần 12 không làm đổi tuần 11.
  - Không đổi `ppct`/`baselines` gốc hoặc lớp Toán 9/4.
  - Chọn bài chỉ thay đổi nội dung xem trước; tên bài chỉ đọc.
  - Gửi yêu cầu lưu lặp lại không tạo bản ghi trùng.
  - Chặn cập nhật từ phiên làm việc cũ và chặn đổi mốc khi có tiết đã xác nhận.
  - Chặn ngày không phải Thứ Hai hoặc trước thời điểm bắt đầu theo dõi.
  - Giữ nguyên `baseline_revisions` sau chu trình serialize/reload và trong snapshot localStorage.

**Chưa kiểm thử được:**
- Google Sheets Production thực, vì không có phiên quyền ghi vào bảng của giáo viên.
- Kiểm thử tương tác Chromium: phiên Chromium headless trong môi trường chạy này không khởi động xong; không ghi nhận là đạt.
- `npm run build:vite`: máy thử không cài `vite` trong `node_modules`; bản build chính `npm run build` hoạt động tốt và không cần vite.

**Khuyến nghị:** Sao lưu Google Sheets và kiểm thử trên một bản sao trước khi triển khai Production. Sau khi triển khai, bắt buộc kiểm tra lưu → F5 → so sánh tuần trước/tuần hiện tại/tuần sau với dữ liệu thực tế.
