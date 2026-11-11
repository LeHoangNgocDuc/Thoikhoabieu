# Báo cáo kiểm thử Smart TKB Web 1.8.2

- **Build:** `npm run build` — PASS.
- **Node:** `npm test` — **110/110 PASS**.
- **Logic lưới:** đúng 7 ngày × 12 ca, 84 vị trí nguyên thủy. Sau gộp hai ca S/C trong dữ liệu mô phỏng còn 82 thẻ; không làm mất bất kỳ bản ghi nào.
- **Sáng/Chiều:** chỉ gộp hai tiết liên tiếp cùng lớp/nhóm, môn, bài, trạng thái. Không gộp khi tiết bên cạnh bị chiếm bởi lịch khác.
- **Buổi Tối:** T1 và T2 luôn hiển thị riêng, kể cả khi tên lớp giống nhau.
- **Chromium CSS thực:** bố cục tại 320×568, 360×740, 390×844, 430×932 đều có header 36px, grid kết thúc đúng mép viewport, không có scroll ngang/dọc ở trang Toàn tuần.
- **Chromium tích hợp mã JavaScript thật:** render từ source modules bằng Blob modules với API Google Sheets mô phỏng, kiểm tra mở/đóng Drawer, chuyển Thống kê, quay lại TKB, và chuyển tuần. PASS.
- **Backend:** API/GAS 1.8.0 không sửa, PPCT/Google Sheets không ghi trong kiểm thử này.

**Không phải xác nhận Production:** kiểm thử không kết nối Google Sheets thật, không triển khai trên Vercel của người dùng.
