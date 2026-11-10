# SMART TKB NAM NHA TRANG — v1.8.0

**Bản mã nguồn hoàn chỉnh để triển khai lên GitHub/Vercel và Google Apps Script.**

## 1. Thay đổi trọng tâm

- **Nhập 3 file XLSX một lần:** nhận diện nội dung `TKB KHỐI 7`, `TKB KHỐI 9`, `THỜI KHÓA BIỂU TIN HỌC`, không lệ thuộc tên file; kiểm tra lần lượt **4 + 8 + 6 = 18 tiết/tuần**; đọc ngày áp dụng 09/11/2026. File có tên `mau-danh-sach-hoc-sinh.xlsx` vẫn được nhận diện đúng là TKB Tin học.
- **Hiệu chỉnh đúng xác nhận giáo viên cho TKB ngày 09/11/2026:** Tin 7/3 Thứ Năm **Sáng tiết 3**, Toán 9/1 Thứ Sáu **Sáng tiết 3**. File gốc khối 9 có sai lệch nên bộ nhập chỉ áp dụng ngoại lệ cho **chữ ký chính xác của TKB 09/11/2026**. Các đợt TKB mới không được tự động mang ngoại lệ này sang.
- **Lịch tuần đủ 7 ngày:** Thứ Hai đến Chủ nhật; Sáng 5, Chiều 5, Tối 2 suất; giao diện lịch theo ngày/tuần trên máy tính, điện thoại.
- **Chính khóa & Tăng vượt thuộc PPCT**; các buổi dạy thêm riêng biệt lưu trong `extra_sessions` / `extra_patterns` và **không** đưa vào PPCT.
- **Thay tiết nguyên tử:** `mutateMainSchedule` với `action='REPLACE'`, một thao tác lưu trên Google Apps Script có `LockService`, ID mới, đọc lại bản ghi sau khi ghi. Chọn phạm vi **chỉ tuần này** hoặc **từ tuần này đến khi có TKB mới**. Giao diện chờ ghi + tải lại dữ liệu thành công trước khi đóng.
- **Xóa/sao chép/dán tiết:** giữ riêng ID nguồn, sao chép không xóa nguồn; xử lý các tiết trùng một cách độc lập.
- **Dạy thêm:** 21 lớp 6A–12C, chọn nhanh khối + A/B/C; danh sách theo khối/hậu tố, ngày, buổi và tuần/tháng, thẻ ca dạy và trạng thái Đã dạy/Chưa dạy/Nghỉ/Bù; nhân bản sang tuần sau.
- **Sửa lỗi “đã lưu nhưng không hiển thị”:** dữ liệu trả về từ `listExtra` được đồng bộ vào bộ dữ liệu hiện đang dùng để vẽ thẻ, thay vì chỉ lưu trong một biến khác.
- **PPCT:** vẫn hiển thị các số thực tế/độ chênh lệch khi chưa xác nhận mốc, đồng thời gắn nhãn **TẠM TÍNH**; không coi bài có trong lịch là đã dạy. Cập nhật mẫu Toán từng lớp: ĐS–HH–ĐS–HH hoặc ĐS–ĐS–HH–ĐS.
- **Xóa cache không xóa PPCT:** xóa snapshot trên thiết bị, bản TKB nhập mới được lưu thành phiên bản mới; các mốc PPCT, xác nhận đã dạy và lịch sử còn nguyên trên Sheets. Không có nút xóa hàng loạt lịch sử PPCT.

## 2. SAO LƯU TRƯỚC KHI CẬP NHẬT

1. Trong ứng dụng hiện tại vào **Cấu hình & dữ liệu → Tải bản sao JSON**.
2. Trên **Google Sheets**, chọn `Tệp → Tải xuống → Microsoft Excel (.xlsx)` để sao lưu toàn bộ tệp.
3. Không xóa/đổi tên bảng `ppct`, `baselines`, `changes`, `ppct_overrides`, `extra_sessions`, `extra_patterns`, `versions`, `slots`. Bản mới tự bổ sung cột `teachingStatus` trong bảng Dạy thêm, giữ nguyên dữ liệu cũ.

## 3. TRIỂN KHAI GOOGLE APPS SCRIPT (BẮT BUỘC)

1. Vào Google Sheets đang dùng, mở `Tiện ích mở rộng → Apps Script`.
2. Trong Apps Script thay **toàn bộ nội dung Code.gs** bằng file `Code.gs` trong thư mục gốc của bộ mã nguồn này (tương đương `gas/Code.gs`). **Không dán trùng lặp vào cả hai file trong cùng Apps Script**.
3. Giữ Script Property `SMART_TKB_API_KEY` đúng với biến `GAS_API_KEY` trong Vercel.
4. Vào `Triển khai → Quản lý tùy chọn triển khai` → chọn bản Web App đang chạy → biểu tượng **bút chì** → **Phiên bản mới** → `Triển khai`.
5. Nếu sửa đúng **deployment hiện tại**, URL `/exec` vẫn giữ nguyên và **không cần thay `GAS_URL`**. Nếu tạo deployment mới riêng, bắt buộc thay URL mới trong Vercel.
6. Không cần chạy hàm xóa sheet; `initSheets_` tạo các bảng/cột còn thiếu và giữ dữ liệu đã lưu.

## 4. TRIỂN KHAI WEB LÊN GITHUB / VERCEL

1. Giải nén ZIP, đẩy **nội dung thư mục** lên thư mục gốc repository GitHub đang kết nối Vercel. Chú ý thư mục `api`, `src`, `public`, file `index.html`, `package.json`, `vercel.json` phải nằm ngay ở gốc repository.
2. Vercel giữ nguyên biến môi trường Production: `APP_PASSWORD`, `SESSION_SECRET`, `GAS_URL`, `GAS_API_KEY` (xem `.env.example`). **Không đưa các bí mật vào mã nguồn hoặc GitHub.**
3. Chờ Vercel triển khai bản mới rồi mở `Cấu hình & dữ liệu → Xác minh phiên bản`. Web/API/GAS đều cần hiển thị **1.8.0**.
4. Nếu vẫn hiện bản cũ, kiểm tra đúng commit ở Vercel, deployment Apps Script và đăng nhập lại trên thiết bị.
5. Vercel build sử dụng `npm run build` (không cần internet cho bước build); file build trong `dist`. `api/` hoạt động như Serverless Functions của Vercel.

## 5. NHẬP LẠI TKB SẠCH (GIỮ PPCT)

1. Mở **Phiên bản TKB → Chọn 3 file Excel (.xlsx) cùng lúc**.
2. Chọn ba file: `26-27.CT-K7-TKB (Lần 4).xlsx`, `26-27.CT-K9-TKB (Lần 4).xlsx`, `mau-danh-sach-hoc-sinh.xlsx`.
3. Chọn **Đọc tất cả file và kiểm tra lịch**; chờ hệ thống báo **18 tiết** và ngày hiệu lực **09/11/2026**. Kiểm tra Tin 7/3 = Thứ Năm sáng tiết 3; Toán 9/1 = Thứ Sáu sáng tiết 3.
4. Bấm **Xác nhận lưu phiên bản**. Sau khi Google Sheets xác nhận ghi và đọc lại, màn hình hiện phiên bản mới. Đừng bấm lưu nhiều lần khi đường truyền chậm.
5. Nếu muốn xóa cache lỗi: **Cấu hình & dữ liệu → Xóa cache trên thiết bị** rồi tải lại trang. Nút này chỉ xóa LocalStorage của ứng dụng trên máy đang dùng, **không xóa dữ liệu trên Google Sheets**. Khi muốn nhập TKB mới trong tương lai, tiếp tục tạo **phiên bản mới**, không ghi đè lịch sử cũ.
6. Ở phần **Phân bổ Toán ĐS/HH theo từng lớp**, chọn và lưu độc lập cho Toán 7/2, 9/1, 9/4.

## 6. THAY TIẾT / DẠY THÊM

- **Thay tiết chính thức:** bấm đúng tiết → `Sửa tiết cố định` → `Thay bằng tiết mới (ID mới)` → chọn lớp, môn, mạch, ngày/tiết → chọn `Chỉ tuần đang xem` hoặc `Từ tuần này đến khi có TKB mới` → `Lưu thay đổi`. Nếu đang có hai tiết trong một ô, chọn đúng lớp trước.
- **Xóa hoặc sao chép:** nút `Xóa tiết này` / `Sao chép` trong hộp thoại; dán vào ô trống. Chức năng Thay thế **không đòi xóa trước**.
- **Tăng vượt thuộc PPCT:** tại ô chính khóa chọn `Thêm tiết dạy bù` và đánh dấu khi đã thực sự dạy. Không dùng `Dạy thêm` cho tăng vượt PPCT.
- **Dạy thêm ngoài PPCT:** từ lịch tuần chọn chế độ `Dạy thêm`; chọn khối 6–12 rồi nút lớp A/B/C. Trên trang `Danh sách dạy thêm` có thể kiểm tra lịch lặp, lọc và cập nhật trạng thái.
- **Nếu báo lịch lặp đã tồn tại mà không thấy thẻ:** bấm `Danh sách dạy thêm → Đồng bộ Google Sheets`. Bản này đọc `listExtra` rồi cập nhật lại đúng nguồn dữ liệu giao diện.

## 7. PPCT & SỐ NHANH/CHẬM

- Chỉ bài **đã được đánh dấu dạy xong**, mốc ban đầu đã xác nhận và tiết tăng vượt chính thức được ghi nhận mới là bằng chứng thực dạy.
- Nếu chưa có mốc xác nhận, bảng vẫn hiển thị `+X tiết (nhanh)`, `-X tiết (chậm)` hoặc `Đúng tiến độ (0 tiết)`, nhưng gắn nhãn **Tạm tính**. Số chênh lệch tạm tính không thể coi là số chính xác đã thực dạy trước khi giáo viên xác nhận mốc/hoàn thành.
- Dữ liệu PPCT không bị xóa khi cập nhật lịch, sửa Dạy thêm hoặc xóa cache thiết bị.

## 8. KIỂM THỬ VÀ GIỚI HẠN

- `npm test`: **99/99** kiểm thử mã nguồn đạt, gồm kiểm thử tình huống trùng lịch cũ *trên fixture riêng*, thay tiết một tuần/lâu dài, dạy thêm độc lập, phân môn và nhập ba file thật.
- Kiểm thử giao diện Chromium desktop 1440 px và mobile 390 px với backend mô phỏng: hiển thị lịch 7 ngày, thẻ dạy thêm, lọc khối, bộ nhập **3 `.xlsx` thật**, giao diện **REPLACE gửi đúng ID tiết nguồn**, không có JavaScript page error.
- `npm run build`: thành công, tạo `dist/` mà không cần Vite.
- **Chưa kiểm thử trực tiếp ghi và tải F5 trên Google Sheets/Vercel Production** vì không có quyền tài khoản triển khai. Sau khi triển khai phải thử lưu một tiết, nhấn F5, so sánh tuần kế và kiểm tra số liệu PPCT thật trước khi sử dụng thường xuyên.

### Nghiệm thu trên hệ thống thật

- [ ] Web/API/GAS hiển thị cùng phiên bản 1.8.0.
- [ ] Nhập đủ 3 file Excel → lịch 18 tiết / không còn ô trùng tuần 10.
- [ ] Thứ Năm sáng tiết 3 là **Tin 7/3**, Thứ Sáu sáng tiết 3 là **Toán 9/1**.
- [ ] Thay tiết **chỉ tuần 10**, lưu, F5 → tiết mới còn nguyên; tuần 11 không bị thay.
- [ ] Thay tiết **đến khi có TKB mới**, lưu, F5 → các tuần tiếp theo áp dụng.
- [ ] Dạy thêm 6A và 12C, lọc khối/ABC, cập nhật trạng thái → F5 vẫn hiện đúng; PPCT chính khóa không thay đổi.
- [ ] Đối chiếu mốc thực dạy, báo nhanh/chậm và các số liệu cần xác nhận.

> **Không thể cam kết đạt 100% trên dữ liệu Production trước khi chạy các bước nghiệm thu trực tiếp.** Mã nguồn đã có các kiểm thử tự động và đọc lại dữ liệu trong backend mô phỏng để giảm thiểu lỗi.
