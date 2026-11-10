# SMART TKB V1.6.1 - Hotfix lưu dạy thêm và UI

Nâng cấp trực tiếp từ V1.6, không tạo mới cơ sở dữ liệu.

### Những thay đổi chính
- Google Apps Script hỗ trợ kiểm tra khả năng ghi `probeExtra` và báo phiên bản `1.6.1`.
- Vercel API cho phép `probeExtra`, trả lỗi có vị trí nguồn `apps-script` khi Web app chưa hỗ trợ thao tác `mutateExtra`.
- Giao diện hiển thị trạng thái máy chủ trong Cấu hình và cảnh báo trong Dạy thêm nếu chưa thể ghi.
- Giữ nguyên nội dung nhập khi lưu lỗi, ghi nhận yêu cầu idempotent, đọc lại dữ liệu sau ghi.
- Bộ lọc **Chỉ hiển thị dạy thêm** chuyển vào sidebar, thêm thanh điều hướng nhất quán trên điện thoại và laptop.
- Không sửa `classes`, `slots`, `ppct`, `baselines`, `changes` trong bản nâng cấp.

Mở `HUONG_DAN_CAP_NHAT_V1_6_1.md` trước khi thay file GitHub và Apps Script.
