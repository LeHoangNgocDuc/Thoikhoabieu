# SMART TKB V1.6.5 - SỬA / THÊM TIẾT CHÍNH KHÓA CỐ ĐỊNH HÀNG TUẦN

Giáo viên: Lê Hoàng Ngọc Đức | Trường THCS Nam Nha Trang | 2026-2027

## Mục tiêu

- Khi thầy chọn tiết chính khóa bị trùng, có thể chọn chính xác tiết của lớp cần sửa, đổi môn/lớp/mạch hoặc dời đến vị trí trống.
- Khi thầy chọn ô trống ở Chính khóa, có thể dùng **Thêm tiết chính khóa cố định hàng tuần**.
- Mặc định các chỉnh sửa/thêm này áp dụng **từ tuần được chọn đến các tuần tiếp theo**, không phải nhập lại mỗi tuần. Các tuần trước đó vẫn dùng TKB cũ; tiến độ/tiết đã xác nhận không bị ghi đè.
- Nếu nhập phiên bản TKB **mới từ trường**, phiên bản mới sẽ thay thế TKB đang áp dụng. Để tiếp tục giữ một thay đổi thủ công sau lần thay TKB trường, kiểm tra trong bản xem trước trước khi lưu.
- **Dạy bù một lần** vẫn riêng biệt; **Dạy thêm** vẫn lưu tại `extra_patterns` và `extra_sessions`, không trộn với `slots` chính khóa.

## Bảo toàn dữ liệu

1. Sao lưu Google Sheets hiện tại bằng Tệp > Tạo bản sao.
2. Sao lưu repository GitHub, hoặc ghi lại commit gần nhất để có thể khôi phục.
3. Không xóa `versions`, `slots`, `changes`, `ppct`, `baselines`, `extra_patterns`, `extra_sessions`.
4. Không dùng nút "Khởi tạo dữ liệu" trên một Google Sheets đã có dữ liệu.

## Bước 1: Cập nhật Google Apps Script (BẮT BUỘC)

Mở Google Sheets hiện tại > Tiện ích mở rộng > Apps Script. Thay nội dung `Code.gs` bằng file `gas/Code.gs` V1.6.5 và Lưu.

- Triển khai > Quản lý tùy chọn triển khai > bút chì > chọn **Phiên bản mới** > Triển khai.
- Nếu cập nhật đúng bản Web app hiện tại bằng bút chì, `GAS_URL` trên Vercel **không đổi**.
- Nếu tạo một Web app deployment hoàn toàn mới, sao chép URL `/exec` mới và đổi `GAS_URL` trên Vercel, sau đó Redeploy.
- Không thay `SMART_TKB_API_KEY` và `GAS_API_KEY` khi chưa cần thiết. Cả hai phải có cùng giá trị.

**Xác minh**: mở URL Apps Script `/exec` trong trình duyệt; kết quả phải có `"apiVersion":"1.6.5"`. Nếu còn số cũ, chính deployment đang dùng chưa được cập nhật.

## Bước 2: Cập nhật GitHub

Bản cập nhật từ V1.6.4 gồm các file:

```
src/core.js
src/main.js
src/style.css
gas/Code.gs
api/tkb.js
api/_auth.js
package.json
public/release.json
```

Thay đúng đường dẫn rồi `Commit changes` lên nhánh `main`. Không chép thư mục bọc ZIP vào thành thư mục con của repository.

## Bước 3: Xác minh Vercel Production

- Mở **Deployments**, kiểm tra trạng thái `Ready` và nhánh Production (`main`).
- Nếu cần, Redeploy bản Production mới nhất.
- Mở `https://thoikhoabieu-sage.vercel.app/api/tkb?action=version`: `apiVersion` phải là `1.6.5`.
- Mở `https://thoikhoabieu-sage.vercel.app/release.json`: frontend phải là `1.6.5`.
- Nếu 2 phiên bản không khớp, chưa thử ghi dữ liệu; kiểm tra deploy/cache.

## Bước 4: Thử sửa một tiết bị trùng

1. Trên **Chính khóa**, chọn tuần có trùng (ví dụ tuần 10).
2. Nhấn cảnh báo trùng tiết hoặc chính ô trùng.
3. Chọn đúng tiết muốn sửa (ví dụ Tin 7/3), không chọn nhầm Toán 9/1.
4. Chọn `Phạm vi: Từ tuần này và TẤT CẢ tuần tiếp theo`.
5. Đổi lớp/môn hoặc chuyển đến thứ, buổi, tiết trống; kiểm tra lại rồi lưu.
6. Đọc lại tuần hiện tại và tuần kế tiếp; xác nhận lịch đúng, số tiết không bị tự nhân đôi.

## Bước 5: Thử thêm một tiết cố định từ ô trống

1. Trên **Chính khóa**, chọn một ô trống; chọn **Chính khóa / Dạy bù**.
2. Nhấn **+ Thêm tiết chính khóa cố định hàng tuần** (khác với `Thêm tiết dạy bù`).
3. Chọn lớp, môn Toán/Tin, mạch Toán nếu cần, thứ/buổi/tiết.
4. Nhấn **Thêm và lưu các tuần sau**; xác nhận trước khi ghi.
5. Tải lại trang và chuyển sang tuần tiếp theo. Tiết phải vẫn xuất hiện ở cùng vị trí.

## Cơ chế lưu

- Apps Script **không ghi đè phiên bản TKB gốc**.
- Tạo một dòng `versions` mới, sao chép các tiết hiện có sang các dòng `slots` liên kết phiên bản mới, rồi cập nhật **đúng một tiết** hoặc bổ sung **một tiết**.
- Dùng `LockService` trong `doPost`. Sau khi ghi, đọc lại `versions` và `slots` rồi đối chiếu; chỉ trả `verified: true` khi đã xác minh đủ.
- Frontend tải lại Google Sheets và đối chiếu mã tiết trả về. Nếu ghi thành công nhưng tải lại thất bại, báo rõ và yêu cầu kiểm tra lại, không giả vờ hoàn tất.
- Tuần trước ngày áp dụng vẫn dùng TKB cũ. Không sửa PPCT đã xác nhận; lịch dạy thêm hoàn toàn độc lập.

## Kiểm thử đã thực hiện

- 72/72 kiểm thử JavaScript đạt, gồm 2 kiểm thử mới cho thao tác thêm tiết cố định lặp hàng tuần.
- Giao diện mô phỏng điện thoại 390px và desktop 1440px: sửa tiết trùng và thêm tiết đều lưu, xuất hiện khi chuyển tuần; trang không tràn ngang.
- Chưa triển khai lên Vercel/Apps Script Production thực tế; chưa thử trực tiếp ghi Google Sheets Production.

Nếu ứng dụng báo `UNSUPPORTED_ACTION` hoặc `VERSION_WRITE_NOT_VERIFIED`, kiểm tra **ba phiên bản**: Frontend, API Vercel và Apps Script, không tạo thêm deployment ngẫu nhiên.
