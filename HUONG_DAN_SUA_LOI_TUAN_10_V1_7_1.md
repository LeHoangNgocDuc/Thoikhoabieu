# Smart TKB 1.7.1 — sửa lỗi tiết Tin 7/3 không xuất hiện ở tuần 10

## Nguyên nhân
Một thao tác `MAIN_DELETE_ONCE` của tuần 10 được lưu trong bảng `changes`. Sau đó người dùng tạo phiên bản TKB mới bắt đầu cùng tuần 10, nhưng khi dựng lịch, chương trình vẫn áp dụng lệnh xóa cũ lên tiết trong phiên bản mới. Do đó tuần 10 bị thiếu tiết, trong khi tuần 11 trở đi đúng.

## Cách khắc phục
- Khi dựng lịch, so sánh `updatedAt` của ngoại lệ một tuần với thời điểm tạo phiên bản TKB (13 chữ số trong ID). Nếu phiên bản TKB bắt đầu đúng tuần đó và được tạo **sau** ngoại lệ, bỏ qua ngoại lệ cũ. Nếu ngoại lệ được tạo **sau** phiên bản, tiếp tục áp dụng bình thường.
- Backend Google Apps Script sử dụng cùng quy tắc khi kiểm tra các ô đã có tiết và khi tạo ngoại lệ mới.
- Không xóa dữ liệu lịch sử hoặc thay đổi PPCT.

## Cập nhật
1. Sao lưu Google Sheet hiện tại.
2. Thay toàn bộ `Code.gs` trong Apps Script bằng bản 1.7.1. Triển khai > Quản lý tùy chọn triển khai > bút chì > Phiên bản mới > Triển khai. Giữ nguyên URL nếu sửa cùng deployment.
3. Đẩy mã nguồn web 1.7.1 lên GitHub/Vercel. Kiểm tra nhãn Web 1.7.1.
4. Mở tuần 10 (09/11–15/11), xem Thứ Năm 12/11 sáng tiết 3; nhấn đồng bộ hoặc tải lại trang. Kiểm tra Tin 7/3 và Toán 9/1 theo dữ liệu TKB hiện hành. So sánh tuần 11.
5. Nếu tiết Tin 7/3 vẫn không có, cần kiểm tra dữ liệu thực tế trong `versions`, `slots`, `changes` của Google Sheet; không nên nhập lại nhiều lần trước khi xác định phiên bản đang hoạt động.

## Kiểm thử
85/85 kiểm thử Node.js đạt, gồm 3 kiểm thử hồi quy mới. Chưa xác minh được ghi/đọc Google Sheet thật của người dùng.
