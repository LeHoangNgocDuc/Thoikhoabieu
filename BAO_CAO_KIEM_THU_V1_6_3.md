# Báo cáo kiểm thử Smart TKB V1.6.3

Ngày lập: 10/11/2026.

## Kết quả

- `node --test tests/*.test.js`: **61/61 đạt**; gồm 53 kiểm thử kế thừa V1.6.2 và 8 kiểm thử xác thực/HTTP bổ sung.
- `node --check` trên API và frontend: đạt.
- `python3 scripts/visual_v163_inline.py`: giả lập hai phiên trình duyệt độc lập ở 1440×900 và 390×844; mỗi phiên đăng nhập, tải 8 lịch từ API mô phỏng, gọi lại khởi tạo phiên và tiếp tục thấy 8 lịch; không có lỗi JavaScript, không tràn ngang trang.
- Google Sheets Production đã được đối chiếu **chỉ đọc**: `extra_patterns` có 8 bản ghi hiện hữu.

## Các trường hợp được kiểm tra trực tiếp bằng mã

- Không có cookie → `UNAUTHENTICATED`, ứng dụng yêu cầu đăng nhập và không sử dụng demo làm dữ liệu thật.
- Cookie hết hạn có HMAC hợp lệ → `SESSION_EXPIRED` / HTTP 401.
- Hai phiên đăng nhập độc lập; đăng xuất một bên không xóa cookie thiết bị kia.
- Login sai mật khẩu / Origin không hợp lệ có HTTP và mã lỗi riêng.
- API trả lỗi upstream 502, không ngụy trang thành thành công/đã có dữ liệu.
- Phản hồi API cấm cache, session có thông tin phiên bản.
- Danh sách dạy thêm sau đăng nhập đủ 8 bản ghi và hiện tiếp sau khởi tạo lại trong browser giả lập.

## Những phần chưa kiểm chứng

- Cookie thật trên điện thoại Samsung/Chrome do thầy sử dụng.
- Trình duyệt/chế độ tiết kiệm dữ liệu của nhà mạng và các extension thực tế.
- Vercel Production sau khi GitHub có commit V1.6.3.
- Tích hợp với Apps Script `/exec` Production theo đường mạng thật.
- `npm run build` với gói Vite vì thư viện không cài được trong môi trường hiện tại; kiểm tra cú pháp và chạy mã qua trình duyệt inline đã đạt.

Vì vậy kết quả **chưa có nghĩa là lỗi đã được xác minh khắc phục trên Production**. Thầy cần kiểm tra sau khi cập nhật; nếu còn lỗi, dùng mã HTTP và trạng thái hệ thống để xác định tiếp.
