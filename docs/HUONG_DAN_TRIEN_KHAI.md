# HƯỚNG DẪN TẠO VÀ TRIỂN KHAI SMART TKB

**Dành cho giáo viên sử dụng Windows, GitHub, Google Sheets và Vercel.**

## A. Mục tiêu của dự án

Ứng dụng Smart TKB phục vụ quản lý thời khóa biểu cá nhân và kế hoạch dạy học ở Trường THCS Nam Nha Trang – Phân hiệu Vĩnh Trường, năm học 2026–2027. Giao diện 7 ngày/tuần, mỗi ngày 5 tiết sáng, 5 tiết chiều và 2 suất tối, tổng 84 ô. Các bộ lọc gồm lớp, buổi, môn, mạch ĐS/HH và loại tiết. Mục tiêu quan trọng là giữ nguyên phiên bản TKB cũ khi nhập TKB mới, và cập nhật tiến độ PPCT theo những tiết thực tế đã dạy/nghỉ/dạy bù.

## B. Dữ liệu đã được chuẩn bị

- Lớp: 7F38, 7F39, 9F43, 9F44, 9F46, 9F47, 9F48.
- Môn: Toán 7, Toán 9, Tin 7, Tin 9.
- Toán 7: ĐS 80, HH 60; Toán 9: ĐS 82, HH 58.
- Tin 7: 35 tiết; Tin 9: 35 tiết.
- Lịch chính khóa nguồn: 18 tiết/tuần; Toán 12, Tin 6.
- Ngày bắt đầu phiên bản mẫu: 09/11/2026 (Tuần 10).

**Kiểm tra trước khi dùng thật:** Thứ Năm sáng tiết 3 ghi hai lớp khác nhau (Tin 7F39 và Toán 9F43). Phải xác minh lịch đúng với nhà trường, không tự chuyển tiết để giải quyết trên phần mềm. Trước khi chốt tuần phải kiểm tra mốc PPCT của từng lớp.

## C. Chạy thử trên máy trước, không cần Google Sheets

**C1.** Cài Node.js LTS từ https://nodejs.org và kiểm tra trong Windows Terminal:

```powershell
node -v
npm -v
```

**C2.** Giải nén file ZIP. Mở thư mục dự án bằng File Explorer, bấm vào thanh địa chỉ và gõ `cmd`, Enter.

**C3.** Chạy `npm install` rồi `npm run dev`, hoặc bấm đúp `KHOI_DONG_WINDOWS.bat`. Mở địa chỉ `http://localhost:5173` (có thể khác nếu cổng bận).

**C4.** Thử bộ lọc Lớp → 7F38 (7/2), Buổi → Chiều. Thử nhấp vào ô có Toán, chọn **Nghỉ**, bấm **Lưu**. Đổi lại Buổi → Cả ngày và kiểm tra nội dung tiết sau.

**C5.** Thử phần PPCT & tiến độ và nút Xuất CSV.

**C6.** Dữ liệu demo trong `localStorage` của trình duyệt đang dùng. Xóa dữ liệu trình duyệt hoặc đổi máy có thể làm mất dữ liệu demo; dùng nút Sao lưu để lưu JSON. Khi kết nối Google Sheets, dữ liệu demo không tự đồng bộ lên Google: cần khởi tạo bản nguồn trên Sheet trống.

## D. Tạo Google Sheets

**D1.** Đăng nhập Google, mở https://sheets.google.com, tạo bảng tính trống tên `SMART_TKB_NAM_NHA_TRANG_2026_2027`.

**D2.** Chọn **Tiện ích mở rộng → Apps Script**. Google sẽ mở trình soạn thảo mã gắn với bảng tính.

**D3.** Mở file `gas/Code.gs` bằng Notepad hoặc VS Code. Copy toàn bộ nội dung và dán vào file `Code.gs` của Apps Script. Bấm Lưu.

**D4.** Vào **Cài đặt dự án** (biểu tượng bánh răng) → **Thuộc tính tập lệnh** → Thêm thuộc tính:

```text
Tên: SMART_TKB_API_KEY
Giá trị: <chuỗi bí mật riêng, tối thiểu 40 ký tự ngẫu nhiên>
```

Không đăng khóa này trong GitHub, không gửi cho học sinh.

**D5.** Chọn **Triển khai → Tùy chọn triển khai mới → Ứng dụng web**, đặt mô tả `Smart TKB v1`. Chọn:

- Thực thi với tư cách: **Tôi**.
- Ai có quyền truy cập: **Bất kỳ ai**.

Điều này cho phép máy chủ Vercel gọi Apps Script, nhưng các yêu cầu vẫn phải có khóa bí mật trùng với `SMART_TKB_API_KEY`. Chỉ dùng URL này ở phần biến môi trường máy chủ của Vercel.

**D6.** Hoàn tất các màn hình cấp quyền Google. Copy URL dạng `https://script.google.com/macros/s/....../exec`.

**D7.** Khi thay code Apps Script về sau, chọn **Triển khai → Quản lý các tùy chọn triển khai**, chỉnh sửa và tạo phiên bản triển khai mới; chỉ lưu code không đảm bảo URL đã chạy code mới.

## E. Đưa mã nguồn lên GitHub

**E1.** Vào https://github.com, tạo repository `smart-tkb-nam-nha-trang`, có thể chọn Private.

**E2.** Tải toàn bộ nội dung thư mục đã giải nén lên repository. Không tải `.env` chứa bí mật, không tải `node_modules` (đã có `.gitignore`).

**E3.** Kiểm tra trên GitHub phải có các thư mục `src`, `api`, `gas`, `public` và các file `index.html`, `package.json`, `vercel.json`. GitHub không tự chạy Apps Script, bước D vẫn cần làm riêng.

## F. Triển khai Vercel

**F1.** Đăng nhập https://vercel.com, chọn **Add New → Project** và kết nối repository GitHub vừa tạo.

**F2.** Vercel nhận diện preset **Vite**. Nếu không tự nhận, chọn Vite; build command `npm run build`; output directory `dist`.

**F3.** Vào **Settings → Environment Variables**, tạo bốn biến:

```text
APP_PASSWORD = [mật khẩu mạnh dùng để vào Smart TKB]
SESSION_SECRET = [chuỗi ngẫu nhiên mạnh, ít nhất 64 ký tự]
GAS_URL = [URL /exec từ bước D6]
GAS_API_KEY = [GIỐNG SMART_TKB_API_KEY từ bước D4]
```

**F4.** Lưu biến môi trường, redeploy. Mở URL `https://<ten-du-an>.vercel.app`.

**F5.** Bấm **Kết nối Google**, nhập giá trị `APP_PASSWORD`. Nếu nhập đúng, ứng dụng sẽ gọi Google Sheets qua máy chủ, không hỏi Google OAuth ở phía trình duyệt.

## G. Khởi tạo dữ liệu mẫu lần đầu

**G1.** Sau khi đăng nhập, vào **Cấu hình & dữ liệu** và bấm **Khởi tạo dữ liệu mẫu trên Sheet trống**.

**G2.** Kiểm tra Google Sheets đã có 6 trang:

```text
classes
versions
slots
ppct
baselines
changes
```

Bảng `classes` có 7 dòng lớp, `slots` có 18 tiết nguồn, `ppct` có 350 mục từ 4 tài liệu, `baselines` có 12 mốc tiến độ lớp/môn/mạch.

**G3.** Nếu Google Sheets đã có dữ liệu, hệ thống từ chối khởi tạo để tránh xóa nhầm. Muốn tạo lại từ đầu, hãy dùng file Google Sheets mới thay vì xóa dữ liệu đang vận hành.

## H. Cài đặt tiến độ PPCT thực tế

**H1.** Mở **PPCT & tiến độ**. Có 12 mục: Toán 7F38 ĐS/HH; Toán 9F43 ĐS/HH; Toán 9F46 ĐS/HH; Tin ở 6 lớp.

**H2.** Mỗi mục chọn **tiết PPCT tiếp theo chưa dạy** (không phải tiết cuối đã dạy). Bấm **Lưu & xác nhận** cho từng mục.

**H3.** Lịch chính khóa tuần 10 được lấy từ file nguồn; mạch ĐS/HH được suy luận theo định mức PPCT tuần học, cần kiểm tra các tiết thực tế nếu nhà trường xếp khác. Chỉ khi mốc đã đúng mới dùng tự dồn bài cho các tuần kế tiếp.

**H4.** Khi nghỉ tiết, nhấn vào ô → **Nghỉ tiết** → Lưu. Tiết PPCT này không được tính hoàn thành. Tiết sau thuộc **cùng lớp/môn/mạch** sẽ được đề xuất nội dung chưa dạy. Chỉ thao tác **Đã dạy** mới được coi là đã xác nhận trên ứng dụng.

**H5.** Khi dạy bù: nhấn ô trống → Thêm tiết → chọn lớp/môn/mạch → loại **Dạy bù chính khóa** → chọn bài nếu cần → Lưu. Đánh dấu đã thực hiện sau buổi học.

## I. Nhập thời khóa biểu mới khi nhà trường đổi lịch

**I1.** Chọn **Phiên bản TKB → Tạo phiên bản mới**. Ứng dụng tạo bản nháp dựa trên phiên bản đang có hiệu lực.

**I2.** Chọn tên phiên bản, ngày bắt đầu, file XLSX và bấm **Đọc file Excel và xem trước**.

**I3.** Có thể lần lượt đọc file khối 7, khối 9, và bảng TKB Tin học. Mỗi file chỉ thay các tiết thuộc phạm vi nhận diện được; các môn còn lại được giữ từ bản nháp.

**I4.** Kiểm tra danh sách tiết trước khi lưu. Nếu ô trùng, nhấn **Xóa** trong bản nháp sau khi kiểm tra với trường. Hệ thống không cho xác nhận khi còn trùng tiết.

**I5.** Bấm **Xác nhận lưu phiên bản**. Từ ngày hiệu lực mới, mọi tuần kế tiếp dùng phiên bản đó. Các tuần cũ tiếp tục dùng phiên bản cũ; PPCT không khởi động lại.

**Lưu ý:** Bộ đọc Excel phiên bản 1 chỉ hỗ trợ định dạng gốc đã gửi, không phải mọi Excel TKB tùy ý. Nếu trường thay bố cục, cần nâng cấp `src/importExcel.js` hoặc cho phép nhập tay trên giao diện trong phiên bản tiếp theo.

## J. Thử nghiệm bắt buộc trước khi dùng thật

1. Tuần 10: Kiểm tra 18 tiết, đặc biệt mốc Thứ Năm sáng tiết 3 trùng lịch.
2. Từ tuần 10 sang tuần 11: Lịch chính khóa không đổi vị trí nhưng PPCT phải chuyển theo tiến độ.
3. Nghỉ một tiết ĐS ở lớp 7F38: tiết sau ĐS tự lùi, HH không đổi.
4. Dạy bù HH vào Chủ nhật: chỉ đúng HH của lớp đó tăng tiến độ.
5. Thêm dạy thêm buổi tối Suất 1: không tự được tính hoàn thành PPCT chính khóa.
6. Nhập phiên bản mới từ Excel có ngày hiệu lực: tuần cũ vẫn giữ lịch gốc.
7. Mở trang trên điện thoại: có thể cuộn ngang bảng.
8. Kiểm tra Google Sheets thật sự có dòng mới trong `changes`/`baselines` sau khi bấm Lưu.
9. Xuất CSV và in theo chế độ hiển thị cần dùng.
10. Sao lưu JSON định kỳ.

## K. Khắc phục lỗi thường gặp

**Không mở được web:** kiểm tra Node.js đã cài, chạy `npm install`, `npm run dev`, và mở đúng địa chỉ hiển thị.

**Đăng nhập báo chưa cấu hình:** kiểm tra `APP_PASSWORD` và `SESSION_SECRET` trên Vercel, sau đó redeploy.

**Apps Script trả về HTML thay vì JSON:** kiểm tra URL kết thúc `/exec`, quyền triển khai và tài khoản dùng làm chủ Sheet. Tạo phiên bản triển khai mới sau khi sửa code.

**Google Sheets không có dữ liệu:** kiểm tra đã bấm **Khởi tạo dữ liệu mẫu trên Sheet trống** và Vercel `GAS_API_KEY` trùng Apps Script `SMART_TKB_API_KEY`.

**Đọc Excel không thấy lịch:** file phải là `.xlsx` và giữ nguyên cấu trúc sheet gốc; thầy Đức trong file phải có mã `Đức` hay `(Đ)` đúng vị trí như file gửi. Bản nhận diện không dùng suy đoán nếu mẫu khác.

**Trùng tiết:** không tùy tiện xóa lịch chưa xác minh. Dùng file trường xác nhận; sau đó mới sửa bản nháp hoặc tạo điều chỉnh ngày cụ thể.

**Lịch sau Tết bị lệch tuần:** dữ liệu năm học 2026–2027 theo hai tuần nghỉ có trong tài liệu PPCT (11/01 và 08/02/2027); nếu lịch trường thay, cập nhật trong `src/core.js` và xây lại web.

## L. Hướng nâng cấp giai đoạn 2

- Thêm màn hình quản lý lớp, môn và giáo viên trực tiếp trên web.
- Bộ nhập TKB bất kỳ mẫu có bước kéo-thả ánh xạ cột, không buộc cùng cấu trúc.
- Tải tài liệu PPCT mới lên web; Gemini Flash hỗ trợ nhận diện, giáo viên duyệt từng dòng.
- Lịch nghỉ toàn trường, ngày kiểm tra, ngày lễ được cấu hình linh hoạt từ Google Sheets.
- Phân loại lịch dạy thêm lặp hàng tuần theo yêu cầu (mặc định tắt).
- Báo cáo PPCT chuẩn trường, xuất Word/PDF, nhật ký kiểm tra và khôi phục phiên bản.
- Xác thực Google, phân quyền nhiều giáo viên, giới hạn đăng nhập và nhật ký truy cập nếu mở rộng toàn trường.
