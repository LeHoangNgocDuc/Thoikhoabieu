# HƯỚNG DẪN NÂNG CẤP SMART TKB V1.6.3

**Giáo viên:** Lê Hoàng Ngọc Đức  
**Năm học:** 2026–2027  
**Dự án:** `thoikhoabieu` trên GitHub/Vercel  
**Tên miền Production:** https://thoikhoabieu-sage.vercel.app

## 1. Nguyên nhân xác định từ mã V1.6.2

`src/main.js` phiên bản V1.6.2 khởi động bằng `GET /api/tkb?action=session`. Nếu điện thoại **chưa có cookie đăng nhập**, API trả `authenticated:false`, nhưng frontend lại tải `seed.json` hoặc dữ liệu mẫu trong trình duyệt (`mode:'demo'`). Khi người dùng mở **Danh sách lịch đã lưu**, chức năng `refreshExtraList()` từ chối truy vấn vì không ở `mode:'google'` và báo "Chức năng danh sách chỉ đọc dữ liệu thật từ Google Sheets". Đây là lỗi luồng trạng thái xác thực, **không chứng minh Sheet thiếu dữ liệu**.

Kết quả kiểm tra Sheet Production (chỉ đọc): `extra_patterns` có **8 lịch lặp**, `extra_sessions` chứa ngoại lệ. Các bản ghi này không được sửa/xóa trong quá trình tạo V1.6.3.

## 2. Sửa những gì

| File | Thay đổi |
|---|---|
| `api/_auth.js` | Trả trạng thái `UNAUTHENTICATED` / `SESSION_EXPIRED` chính xác; cookie host-only `HttpOnly; Secure; SameSite=Lax; Path=/`; gia hạn phiên gần hết hạn; JSON không cache. |
| `api/login.js` | Login trả `apiVersion` và mã lỗi cụ thể, không tiết lộ mật khẩu. |
| `api/tkb.js` | Endpoint phiên báo phiên bản; yêu cầu chưa xác thực trả HTTP 401; lỗi Apps Script/Google Sheets báo HTTP/mã lỗi riêng; `cache: no-store`. |
| `src/main.js` | **Không tự vào chế độ mẫu khi thiếu phiên**; hiển thị đăng nhập, lỗi mạng riêng; đăng nhập thành công tải dữ liệu thật; danh sách dạy thêm tải từ Sheets; thêm kiểm tra hệ thống/phiên bản. |
| `src/style.css` | Giao diện đăng nhập/khôi phục kết nối đẹp, hợp điện thoại. |
| `vercel.json` | HTML và API không cache; asset có tên hash vẫn sử dụng cơ chế mặc định của Vite. |
| `package.json` | Nâng số phiên bản lên 1.6.3. |

**Apps Script (`gas/Code.gs`):** Không thay đổi trong bản vá này. Hệ thống vẫn dùng Apps Script **1.6.2** và các bảng đã có. Nếu thầy đã triển khai backend 1.6.2 thành công, **không cần triển khai lại Apps Script**.

## 3. Cập nhật lên GitHub

1. **Sao lưu:** Vào Google Sheets → **Tệp → Tạo bản sao**. Tải hoặc lưu ZIP bản mã nguồn GitHub hiện hành.
2. Giải nén ZIP cập nhật V1.6.3. Trên repository `Thoikhoabieu` của GitHub, thay đúng **7 file**:

   ```text
   api/_auth.js
   api/login.js
   api/tkb.js
   src/main.js
   src/style.css
   vercel.json
   package.json
   ```

3. Giữ nguyên mọi file khác: `src/core.js`, `gas/Code.gs`, `public/seed.json`, `src/importExcel.js`, toàn bộ dữ liệu PPCT.
4. Nhấn **Commit changes** trên nhánh `main`.
5. Vào **Vercel → Deployments**, xác nhận bản mới **Ready** và có gắn Production. Nếu Vercel chưa tự build, chọn **Redeploy**.
6. Mở **https://thoikhoabieu-sage.vercel.app** trên cả hai thiết bị. Tránh dùng URL preview/triển khai khác vì cookie gắn với từng tên miền.

## 4. Thử trên điện thoại

1. Mở website bằng Chrome Android hoặc Samsung Internet, không dùng cửa sổ trong Zalo.
2. Nếu xuất hiện **Đăng nhập Smart TKB**, nhập `APP_PASSWORD` đã cấu hình trên Vercel.
3. Sau khi đăng nhập, chọn menu `☰` → **Danh sách dạy thêm**.
4. Kỳ vọng **8 lịch lặp** (hoặc số mới hơn nếu thầy đã lưu thêm).
5. Tải lại trang. Nếu cookie vẫn còn hạn, trang phải tự đọc Google Sheets. Vào danh sách lần nữa và so sánh.
6. Đăng nhập trên máy tính ở domain tương tự; kiểm tra cùng danh sách, lớp và số lượng.
7. Trong **Cấu hình & dữ liệu → Kiểm tra trạng thái hệ thống**, kỳ vọng: Frontend 1.6.3, API 1.6.3, Apps Script 1.6.2, phiên `authenticated`, Google Sheets đã kết nối.

**Không nhập lại lịch nếu điện thoại chưa hiển thị.** Khi có lỗi, ghi lại **mã lỗi + HTTP status** và kiểm tra Vercel Function Logs theo thời điểm.

## 5. Phân biệt các trường hợp lỗi

| Mã | Ý nghĩa | Xử lý |
|---|---|---|
| `UNAUTHENTICATED` | Thiết bị chưa đăng nhập | Đăng nhập bằng mật khẩu Smart TKB |
| `SESSION_EXPIRED` | Cookie đã hết hạn | Đăng nhập lại |
| `INVALID_CREDENTIALS` | Mật khẩu sai | Kiểm tra `APP_PASSWORD` |
| `BACKEND_NOT_CONFIGURED` | Thiếu `GAS_URL` hoặc `GAS_API_KEY` trong Production | Kiểm tra Environment Variables; không gửi khóa cho ai |
| `UPSTREAM_ERROR` / `UPSTREAM_TIMEOUT` | Vercel không đọc được Apps Script | Kiểm tra URL `/exec`, quyền triển khai, log |
| `SHEETS_READ_FAILED` | Apps Script/Google Sheets trả dữ liệu lỗi | Đối chiếu tab và nhật ký Apps Script |
| `NETWORK_ERROR` | Trình duyệt không gọi được API | Kiểm tra mạng, thử lại; không xóa dữ liệu |
| `UNSUPPORTED_ACTION` | Backend triển khai sai phiên bản | Kiểm tra Apps Script Web app version |

## 6. Kiểm thử đã thực hiện

- **61/61 bài kiểm thử Node** đạt: 53 nghiệp vụ cũ và 8 kiểm thử API/xác thực mới.
- **Trình duyệt mô phỏng** desktop 1440×900 và điện thoại 390×844: không có lỗi JavaScript; mỗi phiên tự đăng nhập, đọc 8 lịch; gọi lại khởi tạo phiên vẫn đọc được 8 lịch; không tràn ngang toàn trang.
- Google Sheets Production đã được **đọc** để đối chiếu số lịch. Không ghi đè Production.
- **Chưa kiểm chứng:** cookie và lượt đọc trên Chrome/Samsung Internet của điện thoại thật sau khi triển khai Vercel Production; hiện chưa có bằng chứng HTTP status từ máy thầy. Đây là bước nghiệm thu bắt buộc.

## 7. Không cần đổi khóa hoặc Apps Script

Không thay đổi `APP_PASSWORD`, `SESSION_SECRET`, `GAS_API_KEY`, `SMART_TKB_API_KEY` hoặc `GAS_URL` nếu các giá trị hiện tại vẫn đúng. Không cần thêm bảng Google Sheets hoặc khởi tạo lại dữ liệu.

**Điểm dừng an toàn:** Nếu sau khi nâng cấp thiết bị vẫn báo `401`, gửi ảnh màn hình hiển thị mã lỗi và phiên bản ở mục Cấu hình. Không xóa Sheet hoặc thử sửa hàng loạt PPCT.
