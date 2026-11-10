# Smart TKB V1.6.2 – Đồng bộ dạy thêm và thống kê PPCT chính xác

Mã nguồn nâng cấp trực tiếp V1.6.1 cho trường THCS Nam Nha Trang, giáo viên Lê Hoàng Ngọc Đức. Không thay cấu trúc chính khóa hiện tại, chỉ thêm xử lý xác minh khi ghi dạy thêm và thống kê có điều kiện xác nhận.

- `src/core.js`: Dựng lịch lặp độc lập, tính kế hoạch PPCT theo tuần/ngày, kiểm đếm mã tiết đã xác nhận, bỏ qua dạy thêm và tiết trùng.
- `src/main.js`: Lịch, danh sách dạy thêm, trạng thái ghi/đồng bộ, thống kê theo lớp/mạch.
- `src/style.css`: Giao diện máy tính/điện thoại và báo cáo thống kê.
- `api/tkb.js`: Vercel proxy bảo vệ khóa GAS, kiểm tra xác minh bản ghi.
- `gas/Code.gs`: Google Apps Script đọc/ghi theo requestId, xác minh đọc lại, lịch sử, phiên bản.
- `tests`: Bộ kiểm thử JavaScript.
- `HUONG_DAN_V1_6_2.md`: Hướng dẫn GitHub/Vercel/Apps Script và các giới hạn thử nghiệm.

**Chạy thử:** `npm install && npm test && npm run dev`. **Triển khai:** theo `HUONG_DAN_V1_6_2.md`.

**Không được khởi tạo lại hoặc xóa Google Sheets Production.**
