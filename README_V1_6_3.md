# Smart TKB V1.6.3 – Cross-device session recovery

Nâng cấp giữ nguyên dữ liệu và nghiệp vụ V1.6.2, sửa lỗi điện thoại rơi vào chế độ mẫu khi không có cookie và dẫn đến danh sách dạy thêm trống.

- Frontend: giao diện đăng nhập và khôi phục phiên; không dùng demo làm fallback khi lỗi mạng / chưa xác thực.
- API: cookie host-only, HTTP 401 tách biệt lỗi upstream, no-store và metadata phiên bản.
- Apps Script: không thay đổi; giữ phiên bản V1.6.2.
- Danh sách dạy thêm: tiếp tục đọc `extra_patterns`/`extra_sessions` qua API sau khi đăng nhập.

Xem `HUONG_DAN_NANG_CAP_V1_6_3.md`.

Kiểm thử: `npm test` hoặc `node --test tests/*.test.js`. Ứng dụng được xây dựng qua Vite: `npm install && npm run build`.

Chú ý: không đăng tải `.env`, khóa API hoặc mã bí mật lên repository. Việc kiểm tra trên Chrome/Samsung Internet và Production vẫn cần thực hiện sau khi triển khai.
