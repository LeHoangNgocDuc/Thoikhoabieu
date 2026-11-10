# BÁO CÁO KIỂM THỬ SMART TKB 1.8.0

Kiểm tra ngày 10/11/2026.

| Phạm vi | Kết quả | Ghi chú |
|---|---|---|
| Kiểm thử JavaScript / API mô phỏng | **99/99 đạt** | `node --test tests/*.test.js` |
| Build ứng dụng | **Đạt** | `npm run build`, tạo `dist/` bằng Node.js |
| Đọc 3 Excel thật | **Đạt** | 4 tiết Toán 7 + 8 Toán 9 + 6 Tin = 18, áp dụng 09/11/2026 |
| Hiệu chỉnh được xác nhận | **Đạt** | Toán 9/1: Thứ Sáu sáng tiết 3; Tin 7/3: Thứ Năm sáng tiết 3 |
| Kiểm tra trùng lịch sau hiệu chỉnh | **0 vị trí trùng** | File khối 9 có vị trí nguồn khác, sửa có điều kiện |
| Thay tiết một tuần / các tuần sau | **Đạt mô phỏng backend** | Giao dịch một lần, ID mới, đọc lại dữ liệu |
| Hộp thoại nút Thay thế | **Đạt desktop và mobile** | Gửi action REPLACE cùng `sourceSlotId` tiết gốc; sửa lỗi phiên bản trước |
| Dạy thêm | **Đạt mô phỏng backend và UI** | 21 lớp, lọc 6A/12C, trạng thái, lịch lặp nhiều tuần, không tính PPCT |
| Đồng bộ listExtra | **Đạt mô phỏng UI** | API trả danh sách khi GET base thiếu → thẻ vẫn xuất hiện |
| Quy tắc ĐS / HH | **Đạt kiểm thử** | ĐS–HH–ĐS–HH hoặc ĐS–ĐS–HH–ĐS theo lớp |
| Tính toán PPCT khi chưa xác nhận mốc | **Đạt về hiển thị** | Số chênh lệch hiện kèm nhãn **Tạm tính** |
| Ghi thực tế lên Google Sheets / F5 trên Production | **Chưa kiểm tra** | Phải triển khai GAS và Vercel bằng tài khoản của giáo viên |

**Giới hạn:** “99/99 đạt” là số kiểm thử tự động, không phải bảo đảm tuyệt đối 100% mọi trường hợp dữ liệu. Các bài kiểm thử cũ cần tái dựng lỗi trùng lịch Thứ Năm sử dụng **fixture lịch sử riêng**; dữ liệu chuẩn của ứng dụng đã được hiệu chỉnh và không còn trùng ở tuần 10.

Đọc `README_V1_8_0.md` trước khi triển khai. Luôn sao lưu toàn bộ Google Sheets/PPCT trước khi nhập TKB mới.
