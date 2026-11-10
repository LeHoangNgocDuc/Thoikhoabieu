# SMART TKB V1.6.1 - SỬA LỖI KHÔNG LƯU DẠY THÊM VÀ ĐỒNG BỘ GIAO DIỆN

**Giáo viên:** Lê Hoàng Ngọc Đức  
**Đơn vị:** Trường THCS Nam Nha Trang  
**Năm học:** 2026-2027

## 1. Kết luận chẩn đoán

Trong Google Sheets đang kết nối, dữ liệu cũ tại `extra_patterns` và `extra_sessions` **vẫn tồn tại**. Tại thời điểm kiểm tra, hai trang tính mới chỉ có các tiêu đề của bản trước và `extra_requests` chưa xuất hiện. Trong khi đó giao diện đã gọi thao tác `mutateExtra` của V1.6 nhưng nhận lỗi **"Thao tác không được hỗ trợ"**. Vì vậy phải cập nhật **Apps Script đã triển khai** và **API Vercel** cùng mã frontend. Đây là chẩn đoán có căn cứ; trước khi có nhật ký máy chủ thật không thể xác định tuyệt đối mọi nguyên nhân phụ.

## 2. Chuẩn bị và sao lưu

1. Mở file Google Sheets hiện tại. Chọn **Tệp → Tạo bản sao**, ví dụ `SMART_TKB_BACKUP_TRUOC_V161`.
2. Trong Apps Script chọn **Cài đặt dự án → Thuộc tính tập lệnh**, xác nhận có `SMART_TKB_API_KEY`. Không chia sẻ giá trị.
3. Trong Vercel kiểm tra 4 biến `APP_PASSWORD`, `SESSION_SECRET`, `GAS_URL`, `GAS_API_KEY` **vẫn có**, không thay khóa đang sử dụng. `GAS_API_KEY` phải trùng `SMART_TKB_API_KEY`.
4. **Không bấm Khởi tạo dữ liệu mẫu. Không xóa** `classes`, `versions`, `slots`, `ppct`, `baselines`, `changes`, `extra_sessions`, `extra_patterns`, `ppct_overrides`, `audit_log`.

## 3. Cập nhật Google Apps Script - PHẢI LÀM TRƯỚC

1. Trong Google Sheets hiện tại chọn **Tiện ích mở rộng → Apps Script**.
2. Mở tệp `Code.gs` trong dự án Apps Script, sao lưu một bản mã cũ về máy nếu muốn.
3. Sao chép **toàn bộ** mã từ `gas/Code.gs` trong ZIP V1.6.1 vào `Code.gs`, thay mã cũ, bấm **Lưu**.
4. Chọn **Triển khai → Quản lý tùy chọn triển khai**.
5. Tại **Web app đang được Vercel dùng**, bấm biểu tượng **bút chì** để chỉnh sửa. Ở **Phiên bản (Version)** chọn **Phiên bản mới (New version)**, sau đó chọn **Triển khai (Deploy)**.
6. **Ưu tiên sửa bản triển khai Web app hiện có**, không tạo một Web app khác, để giữ nguyên URL `/exec` trong Vercel.
7. Kiểm tra Quyền thực thi: **Thực thi với tư cách: Tôi**. Quyền truy cập web app cần tương thích với cơ chế hiện có (Vercel gửi khóa riêng); không công khai khóa trong mã nguồn.

**Lưu ý:** Chỉ bấm Lưu mã (`Ctrl+S`) trong Apps Script mà **không triển khai phiên bản mới** thì Vercel vẫn gọi mã cũ và lỗi tiếp tục xuất hiện.

## 4. Cập nhật GitHub / Vercel

Trong repository `Thoikhoabieu`, thay đúng các tệp:

```text
api/tkb.js
src/main.js
src/style.css
gas/Code.gs
package.json
```

Bấm **Commit changes**. Vercel thường tự tạo deployment mới. Mở **Vercel → Deployments**, đảm bảo deployment của **Production** thành công. Nếu không tự chạy, dùng Redeploy. Mở tên miền Production đã dùng và tải cứng lại bằng `Ctrl+Shift+R`.

Nếu thầy dùng **bộ mã nguồn đầy đủ** thì cũng giữ nguyên biến môi trường của dự án trên Vercel, không import lại `seed.json` vào Sheets.

## 5. Kiểm tra máy chủ để chắc chắn đã sửa đúng

1. Mở Smart TKB → **Cấu hình & dữ liệu**.
2. Tìm khung **Trạng thái lưu dạy thêm**.
3. Bấm **Kiểm tra máy chủ**.
4. Kết quả cần thấy: **Apps Script 1.6.1 đã hỗ trợ lưu dạy thêm**.
5. Trong Google Sheets phải xuất hiện trang tính `extra_requests` mới (có thể chỉ có hàng tiêu đề nếu chưa lưu suất mới). Các trang `extra_patterns`, `extra_sessions` được **thêm cột ở cuối** mà không xóa dữ liệu cũ.

Nếu còn thông báo **Thao tác không được hỗ trợ**: kiểm tra hai nơi cùng lúc: (a) Vercel đã deploy `api/tkb.js` mới trong đúng Production; (b) Apps Script đã chọn **Phiên bản mới** trong **Quản lý tùy chọn triển khai**. Nếu thầy tạo deployment hoàn toàn mới, phải cập nhật `GAS_URL` cho đúng URL `/exec` mới, sau đó redeploy Vercel. Không gửi khóa hay mật khẩu khi xin trợ giúp.

## 6. Kiểm tra thao tác lưu dạy thêm thực tế

1. Vào **Dạy thêm**.
2. Chọn **một ô còn trống**, không đụng lịch chính khóa và dạy thêm cũ, ví dụ một suất tối hiện không có lịch.
3. Chọn môn Toán, tích 7/2 và 7/3, nhập thêm tên nhóm `Nhóm ôn tập`.
4. Chọn **Lặp hàng tuần**, nhấn **Lưu suất dạy thêm**.
5. Chỉ khi API ghi/đọc lại thành công mới có thông báo xác nhận trên web.
6. **F5** để mở lại trang: ô đó phải vẫn còn 3 lớp/nhóm.
7. Chuyển sang tuần kế tiếp: vẫn xuất hiện lịch lặp.
8. Nhấn ô vừa lưu, chọn **Chỉ ngày này** và thêm hoặc xóa nhóm → lưu → xác nhận tuần sau không bị đổi nếu chỉ sửa một ngày.
9. Xem dữ liệu phát sinh trong `extra_patterns`, `extra_sessions` và `extra_requests`.

**Nếu lỗi khi lưu:** hộp nhập vẫn mở, nội dung chưa bị xóa. Đọc thông báo trong hộp và sửa; không tự động tạo lại một suất khác. Nếu một thao tác đã được máy chủ ghi nhưng tải lại thất bại, hãy bấm **Tải lại Google Sheets** thay vì bấm tạo suất mới.

## 7. Về giao diện và dữ liệu

- Trên **cả desktop và điện thoại** dùng cùng thanh lựa chọn **Chính khóa | Dạy thêm | Tổng hợp** và **Toàn tuần | Theo ngày**.
- Điện thoại 390px thu gọn các ô trong bảng 7 ngày; vào **Theo ngày** để đọc rõ nội dung từng tiết và thao tác chạm dễ hơn.
- Bộ lọc, gồm **Chỉ hiển thị dạy thêm**, nằm trong menu ☰ bên trái, không còn hộp checkbox lớn chiếm diện tích bảng.
- Bảng chính khóa mặc định chỉ sáng 5 tiết, chiều 5 tiết. Dạy thêm và Tổng hợp hiển thị cả 2 suất tối.
- Một suất chứa nhiều lớp/nhóm là **một buổi**, không phải các bản ghi bị trùng.
- Các tiết chính khóa, PPCT, mốc tiến độ và lịch sử học cũ không bị sửa bởi bản cập nhật này.

## 8. Kiểm thử trước bàn giao

Đã chạy **43 bài kiểm thử tự động** (bao gồm kiểm tra tương thích API, hỗ trợ thao tác dạy thêm, chống gửi trùng) và chạy giao diện trình duyệt cục bộ ở **390 × 844**, **820 × 1180** và **1440 × 900**. Không ghi nhận lỗi JavaScript hoặc tràn trang ngang trong các tình huống thử.

**Chưa thể khẳng định đã sửa xong trên Production** cho đến khi thầy thực hiện hai bước triển khai và thử ghi/đọc một suất dạy thêm trực tiếp trong Google Sheets thật. Bản cập nhật này chưa tự thay mã trên GitHub, Apps Script hay ghi dữ liệu tài khoản của thầy.
