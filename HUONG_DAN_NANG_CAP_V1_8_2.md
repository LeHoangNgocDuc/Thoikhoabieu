# Smart TKB 1.8.2 — Hướng dẫn cập nhật giao diện điện thoại

## Phạm vi
- Web: **1.8.2** (chỉ thay CSS, bộ dựng lưới và trạng thái chuyển chế độ).
- Vercel API: **1.8.0**, giữ nguyên.
- Google Apps Script: **1.8.0**, giữ nguyên — **không** cần thay `Code.gs` hoặc `GAS_URL`.
- Không xóa Google Sheets, lịch sử PPCT, lịch chính khóa hay Dạy thêm.

## Bố cục trên điện thoại
1. Lịch ở chế độ **Toàn tuần** mặc định hiển thị trong một `100dvh`, không cần vuốt ngang/dọc.
2. Dòng tiêu đề 36px: **☰**, **‹**, tên tuần, **›**, nút đổi nhanh (▦ / CK / DT).
3. Bảng CSS Grid có `28px repeat(7,minmax(0,1fr))` × `26px repeat(12,minmax(0,1fr))`: 7 cột ngày, 12 hàng S1–S5, C1–C5, **T1 và T2 riêng**.
4. Dạy thêm Sáng/Chiều **cùng nhóm, cùng nội dung, cùng trạng thái và liền hai tiết**: gộp một thẻ dài hai hàng, **chỉ trong giao diện**. Nếu có tiết khác chiếm một trong hai hàng, không gộp để tránh che mất tiết.
5. Dạy thêm buổi Tối: **T1 và T2 không gộp**, dù cùng lớp.
6. Ẩn `S1·B1`, `S2·B1`, dấu `+` trong các ô trống. Ô hiện tên lớp và dòng môn–PPCT nhỏ gọn; chạm ô để xem/sửa thông tin đầy đủ.
7. Menu bên trái giữ nguyên toàn bộ công cụ, lọc và chức năng; vuốt từ mép trái để mở, chọn xong tự đóng.
8. Khi người dùng **chủ động** chọn `Theo ngày` ở menu, ứng dụng vẫn cho xem chế độ danh sách dễ đọc và cuộn bình thường. Màn hình `Thống kê` và biểu mẫu sửa cũng được phép cuộn — khóa 100dvh chỉ áp dụng cho lưới **Toàn tuần**.

## Cập nhật GitHub + Vercel
1. Sao lưu repository trước khi cập nhật.
2. Giải nén `Smart_TKB_V1_8_2_Luoi_7_Ngay_Zero_Scroll.zip`.
3. Chép đè **các file/danh mục mã nguồn** từ ZIP vào thư mục gốc repository đang kết nối Vercel (giữ nguyên biến môi trường, mật khẩu và Google Sheet ID).
4. Commit và push lên GitHub. Vercel sẽ build với lệnh `npm run build` theo `vercel.json` hiện có.
5. Mở `https://thoikhoabieu-sage.vercel.app/release.json` kiểm tra `release = 1.8.2`. Tải mới bằng `Ctrl+F5` trên máy tính hoặc đóng/mở tab trên điện thoại nếu thấy bản cũ.
6. Không cần sửa Apps Script/GAS_URL, trừ khi backend đang hỏng từ trước.

## Nghiệm thu trên điện thoại
- Bật màn hình dọc, mở **Toàn tuần**: 7 cột T2–CN và 12 hàng từ S1 đến T2 hiện cùng lúc.
- Bấm ☰ và vuốt từ mép trái: menu mở được; chọn Thống kê, quay lại TKB: cuộn trang vẫn đúng chế độ.
- Mỗi ca Tối T1 và T2 hiển thị riêng (không phụ thuộc lớp giống/khác).
- Ca Dạy thêm Sáng/Chiều dài hai tiết được gộp khi thực sự cùng buổi học.
- Chuyển tuần bằng hai mũi tên.
- Chạm từng ô để kiểm tra xem/sửa: thao tác lưu vẫn dùng API 1.8.0 hiện có.

## Lưu ý về khả năng đọc tên lớp
Trên một điện thoại hẹp 320px, mỗi cột ngày chỉ khoảng 41px. Tên lớp thông dụng như `9A_NC`, `8A_NC`, `9B_CB`, `7A_NC` hiển thị trực tiếp và được xuống dòng khi cần. Với tên nhóm đặc biệt dài hoặc nhiều lớp trùng trong một tiết, **không thể đồng thời bảo đảm chữ lớn, hiển thị toàn bộ mọi ký tự và không tràn trong một ô cố định**. Chạm ô để xem đầy đủ tên; thuộc tính trợ năng cũng chứa tên đầy đủ. Dữ liệu không bị rút gọn/xóa.

## Giới hạn kiểm thử
Đã chạy 110 bài kiểm thử Node và kiểm thử Chromium với API/dữ liệu mô phỏng. Chưa triển khai hoặc kiểm thử với tài khoản Google Sheets/Vercel Production của người dùng. 
