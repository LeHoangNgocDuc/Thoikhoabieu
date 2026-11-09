# Đặc tả kỹ thuật nâng cấp Smart TKB sau MVP 1.0

## Mô hình dữ liệu chuẩn

- `classes`: mã lớp duy nhất (7F38...), tên hiển thị, khối, môn được giao.
- `versions`: phiên bản lịch, ngày hiệu lực, ngày kết thúc tham khảo, ghi chú nguồn.
- `slots`: 7 ngày × sáng 1–5, chiều 1–5, tối Suất 1–2, mã lớp, môn, mạch, phiên bản. Trong MVP, slot chính khóa là mẫu hàng tuần.
- `ppct`: bài học, khối, môn, mạch (ĐS/HH/TIN), tuần, số tiết PPCT, tên bài, tên tệp nguồn.
- `baselines`: lớp + môn + mạch, ngày bắt đầu theo dõi, chỉ số PPCT kế tiếp, trạng thái xác nhận.
- `changes`: ngày thực tế, buổi, tiết/suất, loại điều chỉnh (OFF, DONE, EDIT, ADD, CLEAR), lớp, môn, mạch, PPCT, trạng thái.

**Bất biến nghiệp vụ:** (1) phiên bản không ghi đè lịch lịch sử; (2) một giáo viên không dạy hai lớp cùng thời điểm; (3) dạy thêm `EXTRA` không tự cộng PPCT; (4) dạy bù `MAKEUP` cộng đúng mạch và đúng lớp; (5) tiết nghỉ không tăng tiến độ; (6) thay đổi TKB không đặt lại PPCT; (7) PPCT gốc phải được giáo viên duyệt trước khi coi là đúng.

## Các hạn chế về nghiệp vụ cần hoàn thiện

MVP hiện tính `PPCT dự kiến` dựa trên các tiết được xếp và điều chỉnh, chứ chưa có bộ máy quản lý tiến độ chốt tuần độc lập. Khi cần độ tin cậy cao cho báo cáo chính thức, phải bổ sung cơ chế chốt tuần và bản ghi hoàn thành học tập bất biến, đồng thời tách rõ `dự kiến` và `đã xác nhận`; thêm sự kiện bù cho trường hợp đã dạy trước hoặc đổi bài nhiều tiết. Tính năng gán ĐS/HH từ số tiết PPCT tuần cần được xác nhận bằng thao tác giáo viên khi TKB thực tế khác thứ tự mạch.

Đối với nhiều giáo viên dùng cùng lúc, thay Sheets bằng cơ sở dữ liệu có transaction, hàng đợi ghi và phân quyền cấp bản ghi. Sheets phù hợp với cá nhân hoặc tổ nhỏ giai đoạn thử nghiệm.

## Tiêu chí nghiệm thu nâng cấp

Một luồng đầy đủ phải đi từ nhập file lịch mới → preview so sánh phiên bản cũ → xác nhận thay đổi → sinh lịch tuần → chọn buổi/lớp → gắn PPCT từng mạch → nghỉ/dạy bù → xác nhận thực dạy → chốt tuần → xuất báo cáo mà không tạo trùng, mất dữ liệu hay thay đổi lịch lịch sử.
