# Smart TKB 1.8.4 — Điểm bắt đầu PPCT theo tuần, không sửa lịch sử

## Điều chỉnh đã triển khai

**Từ tuần nào, chỉ có hiệu lực từ tuần đó trở đi.** Mỗi lần giáo viên nhấn **Lưu áp dụng từ tuần này**, ứng dụng tạo/cập nhật một bản ghi trong bảng `baseline_revisions`, có `classId`, `subject`, `stream`, `fromDate` (Thứ Hai đầu tuần), `nextIndex` và `ppctId`. Không sửa trực tiếp `baselines`, `ppct`, `changes` hay các tiết ở tuần trước. Nếu có mốc khác ở một tuần sau, mốc đó tiếp tục thay thế mốc trước kể từ tuần có hiệu lực.

**Màn hình chọn bài lấy danh mục PPCT & tiến độ**, hiển thị tên bài và tiết PPCT trong khối **chỉ đọc**. Không còn ô gõ tự do tên bài ở màn hình thiết lập mốc. Bấm chọn tiết chỉ thay đổi phần xem trước, tuyệt đối chưa ghi Google Sheets. Chỉ bấm **Lưu áp dụng từ tuần này**, xác nhận hộp thoại và chờ máy chủ đọc lại thành công mới có thay đổi thật.

**Chống sửa lịch sử:** Hệ thống từ chối đổi mốc nếu khoảng hiệu lực đang có bản ghi tiết chính khóa/tăng vượt **đã xác nhận dạy**. Các tuần trước và việc dạy thêm vẫn không bị ảnh hưởng.

## Cách nâng cấp lên Production

1. **Sao lưu Google Sheets hiện tại**, đặc biệt các tab `baselines`, `ppct`, `changes`, `lesson_edits`, `audit_log`. Không xóa dữ liệu, không nhập lại TKB.
2. Trong Google Apps Script gắn với Google Sheets hiện tại, thay toàn bộ `Code.gs` bằng nội dung **Code.gs 1.8.4** trong ZIP. Chọn **Triển khai → Quản lý tùy chọn triển khai → bút chì → Phiên bản mới → Triển khai**. Nếu giữ cùng deployment thì **không đổi `GAS_URL`**.
3. Đẩy mã nguồn Web/API 1.8.4 lên repository GitHub đã kết nối Vercel. Chờ Vercel hoàn thành build. Kiểm tra Web/API/GAS cùng là **1.8.4** trước khi thao tác.
4. Apps Script sẽ tự tạo **sheet `baseline_revisions`** có cột tiêu đề lần đầu được gọi. Không tự tạo hoặc chỉnh sửa các dòng trong tab `baselines`.
5. Mở **PPCT & tiến độ → Thiết lập điểm bắt đầu theo từng lớp**; chọn **Thứ Hai bắt đầu áp dụng**, chọn bài trong danh sách PPCT, đọc phần **Nội dung bài từ PPCT & tiến độ (chỉ xem)**, sau đó **Lưu áp dụng từ tuần này**.
6. Ví dụ: đổi Toán 9/1 ĐS từ tuần 11 (16/11/2026) sang Tiết 27. Kiểm tra lại tuần 10 (09/11/2026) — phải giữ nguyên bài cũ. Tuần 11 có tiết đầu mới; các tuần tiếp theo chạy theo thứ tự PPCT mới.
7. Nhấn F5, đồng bộ lại Google Sheets, kiểm tra cả tuần trước, tuần đổi và tuần sau.

## Hành vi và giới hạn

- Chỉ được chọn ngày **Thứ Hai**; không được chọn ngày trước mốc theo dõi ban đầu.
- Mỗi lớp/môn/mạch có thể có nhiều bản ghi thời điểm hiệu lực. Dòng mốc cũ không bị sửa bởi việc thêm mốc mới.
- Các thay đổi tên bài theo lớp trong `lesson_edits` do phiên bản trước đã lưu vẫn được đọc và bảo lưu, nhưng **không thể sửa tên bài tại màn hình Điểm bắt đầu**.
- Tải trang trong chế độ xem bản lưu sẽ đọc `baseline_revisions` từ cache; thao tác lưu vẫn yêu cầu kết nối Google Sheets.
- Nếu đã có tiết được xác nhận sau mốc muốn đổi, ứng dụng **chặn** đổi mốc thay vì tự động sửa lịch sử.
- Việc ứng dụng thực sự ghi thành công trên Google Sheets Production của giáo viên chỉ xác nhận được sau khi thầy triển khai và kiểm tra F5 thực tế.

## Cấu trúc đóng gói

- `index.html`, `src/`, `public/`, `api/`, `vercel.json`, `package.json`: Web + Vercel API.
- `Code.gs`, `gas/Code.gs`: cùng một mã Google Apps Script 1.8.4.
- `dist/`: bản build không cần phụ thuộc ngoài.
- `tests/`: kiểm thử Node.
