# SMART TKB V1.6 — HƯỚNG DẪN NÂNG CẤP

**Giáo viên:** Lê Hoàng Ngọc Đức  
**Đơn vị:** Trường THCS Nam Nha Trang  
**Năm học:** 2026–2027  
**Nền tảng hiện tại:** GitHub → Vercel → Google Apps Script → Google Sheets.

## 1. Những tính năng được thêm

1. **Lịch dạy thêm bền vững:** Một API `mutateExtra` lưu và đọc lại bản ghi từ Google Sheets trước khi báo thành công. Mỗi yêu cầu có `requestId` để giảm nguy cơ tạo trùng khi người dùng thử gửi lại.
2. **Một suất nhiều lớp/nhóm:** Chọn nhiều lớp trường đang quản lý, thêm nhóm tự do (ngăn bằng dấu phẩy hoặc xuống dòng), tối đa 60 tên trong một suất. Một suất chỉ là một bản ghi.
3. **Lịch lặp:** Lặp hàng tuần (mặc định); chỉ một tuần; lặp đến một ngày xác định. Với lịch đã lặp, chọn sửa riêng ngày, sửa từ ngày đó, hoặc sửa toàn bộ. Có nghỉ một tuần, dừng chuỗi hoặc ẩn toàn bộ chuỗi. Với lịch cũ chỉ một lần, có thể chuyển sang lịch lặp.
4. **Bố cục đáp ứng:** Trên điện thoại có **Toàn tuần** (7 cột, ô thu gọn) và **Theo ngày** (thẻ lớn, bấm dễ). Thanh bộ lọc nằm trong menu ☰ bên trái. Máy tính có chế độ vừa màn hình/toàn màn hình.
5. **Chẩn đoán kết nối:** `Cấu hình & dữ liệu → Kiểm tra dạy thêm đã lưu` hiển thị số mẫu lặp, số ngoại lệ và số yêu cầu đã ghi.

Chức năng chính khóa, phiên bản TKB, PPCT Toán ĐS/HH, PPCT Tin, mốc tiến độ và thống kê V1.5 được kế thừa, không tái tạo dữ liệu.

## 2. Sao lưu Google Sheets — bắt buộc trước cập nhật

1. Mở bảng Google Sheets đang kết nối Smart TKB.
2. Vào **Tệp → Tạo bản sao**. Đặt tên có ngày, ví dụ `SMART_TKB_BACKUP_TRUOC_V1_6_2026-11-10`.
3. Chỉ sau khi thấy bản sao trong Drive mới cập nhật mã.
4. **KHÔNG** nhấn *Khởi tạo dữ liệu mẫu* và **KHÔNG** xóa, đổi tên các tab dữ liệu hiện có.

V1.6 chỉ **bổ sung cột vào cuối** `extra_sessions` và `extra_patterns`, đồng thời tạo `extra_requests` nếu chưa có. Mã của phiên bản này không cần xóa hoặc ghi lại dữ liệu TKB/PPCT đang lưu.

## 3. Cập nhật Google Apps Script trước

1. Mở Google Sheets → **Tiện ích mở rộng → Apps Script**.
2. Trong dự án cũ, mở `Code.gs`. Sao lưu nội dung mã cũ ra một tệp trên máy trước.
3. Sao chép toàn bộ `gas/Code.gs` trong mã nguồn V1.6 thay vào `Code.gs`. Bấm **Lưu**.
4. Vào **Triển khai → Quản lý tùy chọn triển khai**; chọn Web app **đang dùng** → biểu tượng bút chì → **Phiên bản mới** → **Triển khai**.
5. Giữ nguyên cùng deployment và cùng đường dẫn `/exec`. Chỉ khi Google cấp URL khác mới cập nhật `GAS_URL` trên Vercel.
6. Giữ nguyên thuộc tính tập lệnh `SMART_TKB_API_KEY` — không thay khóa và không chép khóa vào GitHub.

**Nếu mở trang `/exec` thấy thông báo nền tảng đã triển khai, đây không phải thử nghiệm ghi.** Kiểm tra thực tế trên web sau khi hoàn thành Vercel.

## 4. Cập nhật GitHub

Mở repository `Thoikhoabieu` và thay **đúng đường dẫn** các tệp sau từ bộ cập nhật:

```text
src/core.js
src/main.js
src/style.css
api/tkb.js
gas/Code.gs
package.json
```

Khi thay các file, giữ nguyên tên thư mục, không đưa cả thư mục `Smart_TKB_V1_6` vào trong repository hiện tại. Nếu dùng bộ mã nguồn đầy đủ, sao chép các tệp vào **gốc** repository.

Nhấn **Commit changes**. Mở Vercel → **Deployments** xem bản Production đã hoàn tất. Không thay `APP_PASSWORD`, `SESSION_SECRET`, `GAS_URL`, `GAS_API_KEY` trừ khi thực tế có thay đổi deployment.

## 5. Kiểm tra sau triển khai

1. Vào https://thoikhoabieu-sage.vercel.app và đăng nhập. Phải hiện trạng thái **Google Sheets**.
2. Chọn tuần 10. Kiểm tra đủ các tiết chính khóa như trước. Chế độ mặc định **Chính khóa** không hiển thị buổi tối.
3. Chọn menu ☰ → **Dạy thêm**. Hệ thống hiện đủ sáng/chiều/tối.
4. Chọn ô trống, ví dụ thứ Bảy tối Suất 1. Tích hai lớp có sẵn và nhập một tên nhóm mới; nhập nội dung bài, chọn **Lặp hàng tuần**. Bấm **Lưu**.
5. Chỉ coi thành công khi có thông báo xác nhận mã bản ghi từ Google Sheets.
6. **Tải lại trang** trên điện thoại hoặc máy tính; mở lại cùng ô. Kiểm tra đủ các lớp/nhóm.
7. Chuyển tuần kế tiếp. Kiểm tra suất lặp vẫn xuất hiện, **Buổi thứ** tăng theo chuỗi.
8. Sửa chỉ ngày đó rồi kiểm tra tuần sau không bị đổi. Thử nghỉ riêng một tuần.
9. Mở **Cấu hình & dữ liệu → Kiểm tra dạy thêm đã lưu** để đối chiếu tổng số bản ghi.

## 6. Nếu không lưu hoặc không hiển thị

| Hiện tượng | Việc cần làm |
|---|---|
| Hiển thị **Chế độ dùng thử** | Vào Cấu hình & dữ liệu, đăng nhập kết nối Google Sheets. Không coi dữ liệu dùng thử là dữ liệu đã lưu trên máy chủ. |
| Bấm lưu bị lỗi, hộp thoại vẫn mở | Đọc thông báo đỏ bên dưới, kiểm tra `GAS_URL`, phiên bản triển khai Apps Script và khóa đã tồn tại. Giữ nguyên nội dung để thử lại. |
| Thông báo **đã lưu nhưng đọc lại không thành công** | Không tạo suất thứ hai; dùng nút **Tải lại Google Sheets**, sau đó dùng mục chẩn đoán để kiểm tra. |
| `Thao tác không được hỗ trợ` | Backend Apps Script hoặc `api/tkb.js` vẫn đang chạy mã cũ; cập nhật cả hai. |
| Lịch chỉ thấy ở tuần hiện tại | Kiểm tra trường **Lịch lặp**. `Chỉ một tuần` không xuất hiện ở tuần sau. |
| Thêm nhóm nhưng báo suất đã tồn tại | Mở suất cũ tại cùng ô để **sửa danh sách lớp**; không tạo suất độc lập cùng thời điểm. |
| TKB chính khóa bị trùng | Không tự đổi tiết; chỉ kiểm tra và điều chỉnh theo phân công nhà trường. |

## 7. Cấu trúc dữ liệu mở rộng (không phá hủy)

`extra_patterns`: tiếp tục quản lý mẫu lặp, thêm sau các cột cũ:

```text
classIds, customGroups, lessonTitle, startTime, endTime,
repeatRule, revision, requestId
```

`extra_sessions`: quản lý buổi lẻ, chỉnh sửa/nghỉ riêng ngày, thêm sau các cột cũ:

```text
classIds, customGroups, lessonTitle, startTime, endTime,
repeatRule, revision, requestId
```

`extra_requests` (mới):

```text
id, action, entityId, createdAt, resultJson
```

V1.6 vẫn giữ trường `groups` dạng mảng JSON để đọc được các bản ghi V1.3–V1.5. Các mốc `baselines` chưa xác nhận vẫn không được coi là các tiết đã dạy thật.

## 8. Rollback nếu gặp sự cố

1. Không xóa dữ liệu Google Sheets, kể cả những cột/tab mới.
2. Nếu Vercel có lỗi, vào **Deployments** → dùng bản V1.5 đã hoạt động trước đó hoặc khôi phục commit GitHub.
3. Nếu Apps Script gây lỗi, đưa `Code.gs` cũ trở lại và triển khai thêm một phiên bản mới trên cùng deployment.
4. Tab và cột mới của V1.6 có thể để nguyên; phiên bản cũ không nên chủ động xóa chúng.
5. Sau khi ổn định, dùng bản sao Google Sheets đã tạo để đối chiếu dữ liệu; chỉ phục hồi dữ liệu thủ công khi chắc chắn không làm mất các chỉnh sửa mới.

## 9. Kết quả kiểm tra trong môi trường bàn giao

- **40/40 bài kiểm thử JavaScript đạt:** 30 bài hiện có V1.5 và 10 bài mới V1.6.
- Đã thử giao diện bằng Chromium tại **390×844**, **820×1180**, **1440×900**; không có lỗi JavaScript quan sát được, không có tràn chiều ngang trang trong các kích thước này.
- Đã thử tạo suất dạy thêm giả lập gồm hai lớp có sẵn và một nhóm tự do; sau khi chuyển tuần, lịch vẫn xuất hiện.
- Đã kiểm thử nghiệp vụ Google Apps Script bằng Spreadsheet giả lập (không phải tài khoản Google Sheets thật).
- **Chưa** xác minh end-to-end trên tài khoản Vercel và Google Sheets Production của thầy. Nên thử một suất mới trước khi dùng đại trà.
- Không đưa khóa bí mật vào source code hoặc file ZIP.
