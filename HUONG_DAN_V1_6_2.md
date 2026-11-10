# SMART TKB V1.6.2 — HƯỚNG DẪN NÂNG CẤP AN TOÀN

**Trường THCS Nam Nha Trang | GV Lê Hoàng Ngọc Đức | Năm học 2026–2027**

## 1. Bản nâng cấp làm gì?

- **Dạy thêm:** Tách `extra_patterns` (lịch lặp), `extra_sessions` (buổi một lần/ngoại lệ), `extra_requests` (chống gửi trùng), `audit_log` (nhật ký). Khi lưu, máy chủ đọc lại bản ghi để so khớp trường dữ liệu; trình duyệt tải lại dữ liệu từ Sheets và kiểm tra suất thực tế xuất hiện ở tuần được chọn. Có nút **Danh sách dạy thêm** và **Kiểm tra đồng bộ Sheets**.
- **Thống kê PPCT:** Tính kế hoạch theo PPCT từng mạch và ngày được chọn; giữa tuần chỉ đếm các lượt dự kiến đã đến ngày, cuối tuần đếm đúng định mức PPCT. Hai tuần nghỉ được giữ nguyên lũy kế. Tính thực tế từ mốc đã xác nhận và mã PPCT được xác nhận đã dạy, khử trùng mã PPCT. Các ô chưa xác nhận mang trạng thái **Chưa đủ dữ liệu**, KHÔNG bị coi là nghỉ hoặc dạy chậm.
- **Hiển thị:** Thêm lọc mạch ĐS/HH/Tin tại màn hình thống kê; dùng cùng dữ liệu trên điện thoại và máy tính. Thu gọn thanh đầu trên điện thoại, bộ lọc trong ngăn bên trái.

## 2. Quan trọng: Trước khi cập nhật

1. Mở Google Sheets thật: `SMART_TKB_NAM_NHA_TRANG_2026_2027`. Chọn **Tệp → Tạo bản sao** để sao lưu.
2. Ghi lại Deployment ID Apps Script hiện tại, URL `/exec` đang chạy và môi trường Vercel (KHÔNG chia sẻ khóa API, APP_PASSWORD, SESSION_SECRET).
3. **Không xóa, không khởi tạo lại Google Sheets.** Không xóa các tab `classes`, `versions`, `slots`, `ppct`, `baselines`, `changes`, `ppct_overrides`, `audit_log`, `extra_patterns`, `extra_sessions`, `extra_requests`.
4. Dữ liệu nguồn được kiểm tra ở chế độ CHỈ ĐỌC. Có một bản sao riêng để thử nghiệm, không được thay bằng bản sao này trong Production nếu không chủ động chuyển dữ liệu.

## 3. Thay mã nguồn

Giải nén bản ZIP cập nhật, giữ đúng cây thư mục; thay trong repository Github `Thoikhoabieu`:

```text
src/core.js
src/main.js
src/style.css
api/tkb.js
gas/Code.gs
package.json
tests/v162-statistics.test.js
```

Giữ nguyên những file không có trong ZIP (đặc biệt seed PPCT, mẫu nhập Excel và API login). Lưu/Commit lên nhánh triển khai Production.

## 4. Cập nhật Apps Script (bắt buộc)

1. Mở Google Sheets → **Tiện ích mở rộng → Apps Script**.
2. Dán mã **`gas/Code.gs` V1.6.2** vào đúng dự án Apps Script đang kết nối với Sheets thật, thay mã cũ. Không sửa `SMART_TKB_API_KEY` trong Thuộc tính tập lệnh.
3. **Triển khai → Quản lý tùy chọn triển khai → chọn triển khai Web app cũ → Chỉnh sửa → Phiên bản: Phiên bản mới → Triển khai**.
4. Nếu đã cập nhật đúng phiên bản của URL `/exec` cũ thì giữ nguyên Vercel `GAS_URL`; nếu tạo Web app mới và có `/exec` mới, cập nhật biến `GAS_URL` trên Vercel.
5. Sau khi cập nhật mã Apps Script, không thử lưu trên phiên bản frontend cũ quá lâu: ngay sau đó đưa GitHub và Vercel lên V1.6.2.

Mã V1.6.2 sẽ bổ sung cột `payloadHash` cuối bảng `extra_requests` nếu thiếu. Đây là nâng cấp không phá hủy bảng cũ, nhưng **vẫn cần sao lưu**.

## 5. Cập nhật Vercel

1. Kiểm tra Vercel có Deploy Production mới từ GitHub; nếu dùng URL Apps Script mới, vào Project → Settings → Environment Variables → `GAS_URL`, sửa URL `/exec` tương ứng rồi redeploy.
2. Không thay `GAS_API_KEY`, `APP_PASSWORD`, `SESSION_SECRET` chỉ để thử sửa lỗi.
3. Mở <https://thoikhoabieu-sage.vercel.app>, nhấn Ctrl+Shift+R trên PC (hoặc tải lại trình duyệt điện thoại).
4. Trong **Cấu hình & dữ liệu → Kiểm tra máy chủ**, phải thấy Apps Script `1.6.2`, có tính năng `verifiedWrites`.
5. Chọn **Danh sách dạy thêm → Đọc từ Google Sheets**. Danh sách phải hiển thị các lịch cũ từ `extra_patterns` ngay cả khi `extra_sessions` có ít dòng.

## 6. Quy trình nghiệm thu dạy thêm

1. Trong bản sao thử nghiệm, thêm tối Chủ nhật Suất 1: Toán; chọn `7F38`, `9F43`, nhập tên tự do `Nhóm 7A` và chọn lặp hàng tuần.
2. Nhấn **Lưu**. API phải trả `ok:true, verified:true, requestId, entityId, revision`.
3. Mở Google Sheets, tìm ID bản ghi trong `extra_patterns`; các giá trị `groups`, `classIds`, `customGroups`, `repeatRule` phải chính xác. `extra_requests` có đúng một dòng với `requestId`.
4. Tải lại web, đi tuần tiếp theo và mở **Danh sách dạy thêm**. Cả lịch lặp và 3 nhóm phải còn.
5. Thử gửi lại nguyên requestId, xác nhận không thêm dòng. Sửa một ngày, kiểm tra tuần sau không bị ảnh hưởng; nghỉ một tuần, kiểm tra tuần sau vẫn có.
6. Kiểm tra từ điện thoại và máy tính trên cùng URL Production, không phụ thuộc localStorage để lấy dữ liệu thật.

**Nếu ghi thành công nhưng tải lại thất bại:** ứng dụng phải hiện “Đã ghi vào Google Sheets nhưng chưa đồng bộ giao diện”, lưu `requestId` cục bộ chỉ để truy vấn trạng thái và không tự tạo thêm suất. Dùng nút **Kiểm tra lại**, không ấn Khởi tạo lại.

## 7. Quy trình nghiệm thu thống kê (rất quan trọng)

- Mở **PPCT & tiến độ** và xác nhận từng mốc `baselines`: chọn **tiết PPCT tiếp theo CHƯA dạy** của từng lớp/mạch, rồi nhấn **Lưu & xác nhận**. Không xác nhận theo PPCT dự kiến nếu thực tế chưa đến đó.
- Trong **TKB chính khóa**, đánh dấu **Đã dạy** với đúng mã PPCT cho từng tiết thực hiện; đánh dấu **Nghỉ** cho tiết thực sự nghỉ. Những ô còn trạng thái *Dự kiến* sẽ được coi là chưa biết, không tự tính là đã dạy hay chưa dạy.
- Mở **Thống kê tiến độ**. Mặc định **Đến hôm nay** theo múi giờ Việt Nam; có lựa chọn hết tuần, học kỳ I, cả năm hoặc ngày tùy chọn.
- Lọc riêng 7F38, 9F43, 9F46 và các mạch ĐS/HH hoặc Tin. Hàng có `Chưa đủ dữ liệu` sẽ KHÔNG có giá trị chênh lệch nhanh/chậm giả.
- Một mã PPCT chỉ được cộng **một lần** dù có dạy bù hai lần. Dạy thêm thường kỳ không tính vào PPCT chính khóa. Báo cáo CSV chứa trạng thái xác nhận và số tiết chưa xác nhận.
- Các kỳ nghỉ 11/01/2027 và 08/02/2027 phải giữ nguyên lũy kế kế hoạch, không về 0.

**Giới hạn thống kê:** Không có phần mềm nào biết chính xác đã dạy hay chưa nếu giáo viên chưa xác nhận. Nếu TKB trong tuần phân bổ khác định mức PPCT (ví dụ số tiết bất thường) thì kế hoạch giữa tuần được gắn cảnh báo ước tính; không tính chênh lệch chính thức khi kết quả chưa đáng tin cậy. Các mốc lịch sử trước ngày bắt đầu phải được giáo viên xác nhận đúng.

## 8. Kiểm thử và phạm vi xác minh

- Chạy cục bộ: `npm install`, `npm test`, `npm run build`.
- Đã chạy trên mô hình mô phỏng Apps Script và frontend; kiểm tra màn hình thống kê ở 390×844, 820×1180, 1440×900.
- Đã đọc nguồn Sheets thật mà không chỉnh sửa, tạo một bản sao và **ghi/đọc lại một bản ghi thử** trên bản sao qua Google Sheets connector. Chưa xác minh API Web app Apps Script V1.6.2 / Vercel Production sau khi thầy cập nhật. Không được coi đó là kiểm thử tích hợp End-to-End hoàn chỉnh.
- URL của bản sao thử nghiệm (không dùng làm Production): https://docs.google.com/spreadsheets/d/1s_lwgVoLbnW2kHEGnl-GPOF_Xks_2SpkRmw1BZef8U8/edit

## 9. Hoàn tác nếu cần

Trên GitHub, quay lại commit V1.6.1 và redeploy; Apps Script có thể chọn triển khai phiên bản trước. Giữ nguyên Google Sheets; chỉ làm thế sau khi sao lưu và ghi lại các bản ghi dạy thêm vừa tạo. Không đặt lại các khóa nếu không có sự cố bảo mật.
