# BÁO CÁO KIỂM THỬ SMART TKB WEB 1.8.1

**Phạm vi:** thay đổi Mobile UI; backend Vercel API/GAS v1.8.0 giữ nguyên.

## Kiểm thử tự động

- Node.js `npm test`: **104/104 đạt**.
- Mô-đun `collapseTutorDisplay`: chỉ gộp các ô kề nhau cùng lớp, ngày, buổi, môn, bài, trạng thái và giờ; các lớp và buổi khác nhau không gộp; dữ liệu gốc không bị thay đổi.
- Các bài kiểm thử hiện hữu về nhập Excel, thay tiết, phiên bản TKB, Dạy thêm, PPCT tiếp tục đạt.
- Build `npm run build`: hoàn thành.

## Chromium — giao diện thực tế với API mô phỏng

| Chiều rộng | Tràn ngang | Header & menu vuốt | Tên nhóm Dạy thêm | Thống kê đủ 5 cột | Lọc rồi đóng menu |
| --- | --- | --- | --- | --- | --- |
| 320 px | Không | Đạt | Đạt | Đạt | Đạt |
| 390 px | Không | Đạt | Đạt | Đạt | Đạt |
| 430 px | Không | Đạt | Đạt | Đạt | Đạt |

- Các trạng thái thử không phát sinh lỗi JavaScript.
- Tên nhóm `9A_NC`, `8A_NC`, `9B_CB` được giữ nguyên; cặp ca mô phỏng liền nhau chỉ hiển thị một thẻ.
- Có thể cuộn xem đến cuối lịch Sáng/Chiều/Tối; chế độ xem Toàn tuần vẫn chọn được trong menu.
- Bảng thống kê mobile có 5 tiêu đề: `Lớp / Môn`, `Kế hoạch`, `Đã dạy`, `Nhanh / Chậm`, `Tiết tiếp theo`.
- Thử chọn lọc lớp `7/3` từ menu Thống kê: menu tự đóng; bảng còn đúng 1 dòng dữ liệu.

## Giới hạn nghiệm thu

Các phép thử Chromium sử dụng ứng dụng frontend thật nhưng mô phỏng phản hồi API, **không phải phiên lưu Google Sheets thật**. Chưa triển khai bản này lên Vercel Production. Không khẳng định tuyệt đối mọi thiết bị Android/iOS đều giống nhau; cần mở lại trên điện thoại của giáo viên sau cập nhật.
